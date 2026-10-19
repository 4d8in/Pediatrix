import type { FastifyInstance } from "fastify";
import { fetchAll } from "../../lib/fhir-search.js";
import { withLock } from "../../lib/keyed-lock.js";
import { hapiClient } from "../../lib/hapi-client.js";
import { loadTariffs } from "../../lib/tariffs.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { INVOICE_ENCOUNTER_SYSTEM, billedState, buildInvoiceLines, computeTotals, toFhirInvoice, unbilledItems } from "./billing.fhir.js";
import { replyHapiError } from "./billing-errors.js";
import { readInvoice } from "./invoice-reader.js";

type Json = Record<string, unknown>;

function validate(body: unknown): { insurer?: string; coveragePercent: number } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const insurer = typeof b.insurer === "string" && b.insurer.trim() ? b.insurer.trim() : undefined;
  const coveragePercent = b.coveragePercent === undefined || b.coveragePercent === "" ? 0 : Number(b.coveragePercent);

  const errors: string[] = [];
  if (!Number.isInteger(coveragePercent) || coveragePercent < 0 || coveragePercent > 100) {
    errors.push("Le taux de prise en charge doit être un entier entre 0 et 100.");
  }
  if (coveragePercent > 0 && !insurer) errors.push("Indiquez l'assureur ou la mutuelle.");
  if (errors.length > 0) return { errors };
  return { insurer, coveragePercent };
}

// Génère la facture d'une consultation : consultation + examens demandés +
// médicaments délivrés, aux tarifs de l'établissement.
export async function createInvoiceRoute(app: FastifyInstance) {
  app.post("/api/billing/encounters/:id/invoice", { preHandler: [authenticate, authorize("cashier")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const insurance = validate(request.body);
    if ("errors" in insurance) {
      return reply.code(400).send({ error: "Requête invalide.", details: insurance.errors });
    }

    try {
      return await withLock(`encounter-invoice:${id}`, async () => {
      const encounter = await hapiClient.get<{ subject?: { reference?: string } }>(`/Encounter/${id}`);
      const patientId = encounter.subject?.reference?.split("/")[1];
      if (!patientId) return reply.code(502).send({ error: "Consultation sans patient associé." });

      const [existing, patient, serviceRequests, dispenses, tariffs] = await Promise.all([
        fetchAll<Json>(`/Invoice?identifier=${encodeURIComponent(`${INVOICE_ENCOUNTER_SYSTEM}|${id}`)}`),
        hapiClient.get<{ name?: { family?: string; given?: string[] }[] }>(`/Patient/${patientId}`),
        fetchAll<Json>(`/ServiceRequest?encounter=Encounter/${id}`),
        fetchAll<Json>(`/MedicationDispense?context=Encounter/${id}&status=completed`),
        loadTariffs(),
      ]);
      const name = patient.name?.[0];
      const patientName = name ? `${name.given?.[0] ?? ""} ${name.family ?? ""}`.trim() : "";

      // Facture complémentaire : seuls les examens et médicaments pas encore facturés.
      const state = billedState(existing as never);
      const pending = unbilledItems(state, serviceRequests as never[], dispenses as never[]);
      if (state.consultationBilled && pending.serviceRequests.length === 0 && pending.dispenses.length === 0) {
        return reply.code(409).send({ error: "Rien de nouveau à facturer pour cette consultation." });
      }
      const lines = buildInvoiceLines(pending.serviceRequests, pending.dispenses, tariffs, {
        encounterId: id,
        includeConsultation: !state.consultationBilled,
      });
      const totals = computeTotals(lines, insurance.coveragePercent);
      const created = await hapiClient.post<{ id: string }>(
        "/Invoice",
        toFhirInvoice(patientId, patientName, id, lines, totals, tariffs.currency, insurance, request.user.name),
      );
      return reply.code(201).send({ invoice: await readInvoice(created.id) });
      });
    } catch (error) {
      return replyHapiError(reply, error, "Consultation introuvable.");
    }
  });
}
