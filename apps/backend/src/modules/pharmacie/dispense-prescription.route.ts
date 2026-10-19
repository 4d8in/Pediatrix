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

      const errors: string[] = [];
      const item = findFormularyItem(itemCode);
      if (!item) errors.push("Article absent du formulaire.");
      if (!Number.isInteger(quantity) || quantity <= 0) errors.push("La quantité doit être un entier positif.");
      if (errors.length > 0 || !item) {
        return reply.code(400).send({ error: "Requête invalide.", details: errors });
      }

      try {
        const prescription = await hapiClient.get<FhirMedicationRequest>(`/MedicationRequest/${id}`);
        if (prescription.status !== "active") {
          return reply.code(409).send({ error: "Cette ordonnance a déjà été délivrée ou clôturée." });
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
              request: { method: "PUT", url: `MedicationRequest/${id}` },
            },
          ],
        };
        const response = await hapiClient.post<{ entry?: { response?: { location?: string } }[] }>("", bundle);
        const location = response.entry?.map((e) => e.response?.location).find((l) => l?.startsWith("MedicationDispense/"));
        return reply.code(201).send({ dispenseId: location?.split("/")[1] });
      } catch (error) {
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
