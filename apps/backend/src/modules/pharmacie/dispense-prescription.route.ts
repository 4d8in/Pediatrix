import { withLock } from "../../lib/keyed-lock.js";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { findFormularyItem } from "../../lib/formulary.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { loadStockLevels } from "./stock-levels.route.js";
import { stockOf, toMedicationDispense } from "./stock.fhir.js";

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  subject?: { reference?: string };
  encounter?: { reference?: string };
  [key: string]: unknown;
}

// Délivrance : choisit l'article du formulaire, vérifie le stock, crée la
// MedicationDispense et clôt la prescription, dans un seul Bundle transaction.
export async function dispensePrescriptionRoute(app: FastifyInstance) {
  app.post(
    "/api/pharmacy/prescriptions/:id/dispense",
    { preHandler: [authenticate, authorize("pharmacist")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const b = (request.body ?? {}) as Record<string, unknown>;
      const itemCode = typeof b.itemCode === "string" ? b.itemCode.trim() : "";
      const quantity = typeof b.quantity === "number" ? b.quantity : Number(b.quantity);
      const confirmMismatch = b.confirmMismatch === true;

      const errors: string[] = [];
      const item = findFormularyItem(itemCode);
      if (!item) errors.push("Article absent du formulaire.");
      if (!Number.isInteger(quantity) || quantity <= 0) errors.push("La quantité doit être un entier positif.");
      if (errors.length > 0 || !item) {
        return reply.code(400).send({ error: "Requête invalide.", details: errors });
      }

      try {
        // Verrou par ordonnance (invariant : une seule délivrance) puis par article (stock).
        return await withLock(`prescription:${id}`, () => withLock(`dispense:${item.code}`, async () => {
        const prescription = await hapiClient.get<FhirMedicationRequest>(`/MedicationRequest/${id}`);
        if (prescription.status !== "active") {
          return reply.code(409).send({ error: "Cette ordonnance a déjà été délivrée ou clôturée." });
        }
        // L'article délivré doit correspondre au médicament prescrit : sinon confirmation explicite (tracée par l'audit).
        const prescribed = prescription.medicationCodeableConcept?.text ?? "";
        if (!confirmMismatch && prescribed.trim().toLowerCase() !== item.name.trim().toLowerCase()) {
          return reply.code(409).send({
            kind: "mismatch",
            error: `L'article choisi (${item.name}) ne correspond pas au médicament prescrit (${prescribed || "non précisé"}). Confirmer la délivrance ?`,
          });
        }
        const patientReference = prescription.subject?.reference;
        if (!patientReference) {
          return reply.code(502).send({ error: "Ordonnance sans patient associé." });
        }

        const available = stockOf(await loadStockLevels(), item.code);
        if (quantity > available) {
          return reply.code(409).send({
            error: `Stock insuffisant pour ${item.name} : ${available} ${item.unit}(s) disponible(s), ${quantity} demandé(s).`,
          });
        }

        const bundle = {
          resourceType: "Bundle",
          type: "transaction",
          entry: [
            {
              fullUrl: `urn:uuid:${randomUUID()}`,
              resource: toMedicationDispense(
                item,
                quantity,
                id,
                patientReference,
                prescription.encounter?.reference,
                request.user.name,
              ),
              request: { method: "POST", url: "MedicationDispense" },
            },
            {
              resource: { ...prescription, status: "completed" },
              request: {
                method: "PUT",
                url: `MedicationRequest/${id}`,
                ...((prescription as { meta?: { versionId?: string } }).meta?.versionId
                  ? { ifMatch: `W/"${(prescription as { meta?: { versionId?: string } }).meta!.versionId}"` }
                  : {}),
              },
            },
          ],
        };
        const response = await hapiClient.post<{ entry?: { response?: { location?: string } }[] }>("", bundle);
        const location = response.entry?.map((e) => e.response?.location).find((l) => l?.startsWith("MedicationDispense/"));
        return reply.code(201).send({ dispenseId: location?.split("/")[1] });
        }));
      } catch (error) {
        if (error instanceof HapiError && error.statusCode === 412) {
          return reply.code(409).send({ error: "L'ordonnance a été modifiée entre-temps : actualisez la liste." });
        }
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          const message = error.statusCode === 404 ? "Ordonnance introuvable." : error.message;
          return reply.code(statusCode).send({ error: message });
        }
        throw error;
      }
    },
  );
}
