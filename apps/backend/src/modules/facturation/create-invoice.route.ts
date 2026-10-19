import type { FastifyInstance } from "fastify";
import { fetchAll } from "../../lib/fhir-search.js";
import { withLock } from "../../lib/keyed-lock.js";
import { hapiClient } from "../../lib/hapi-client.js";
import { loadTariffs } from "../../lib/tariffs.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { COVERAGE_EXTENSION_URL, INSURER_EXTENSION_URL, INVOICE_ENCOUNTER_SYSTEM, billedState, buildInvoiceLines, computeTotals, toFhirInvoice, unbilledItems } from "./billing.fhir.js";
import { replyHapiError } from "./billing-errors.js";
import { readInvoice } from "./invoice-reader.js";

type Json = Record<string, unknown>;

function validate(body: unknown): { insurer?: string; coveragePercent: number; provided: boolean } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const insurer = typeof b.insurer === "string" && b.insurer.trim() ? b.insurer.trim() : undefined;
  const coveragePercent = b.coveragePercent === undefined || b.coveragePercent === "" ? 0 : Number(b.coveragePercent);

  const errors: string[] = [];
  if (!Number.isInteger(coveragePercent) || coveragePercent < 0 || coveragePercent > 100) {
    errors.push("Le taux de prise en charge doit être un entier entre 0 et 100.");
  }
  if (coveragePercent > 0 && !insurer) errors.push("Indiquez l'assureur ou la mutuelle.");
  if (errors.length > 0) return { errors };
  return { insurer, coveragePercent, provided: !(b.coveragePercent === undefined || b.coveragePercent === "") };
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
      // Facture complémentaire sans prise en charge saisie : reprise de celle de la dernière facture.
      let coverage: { insurer?: string; coveragePercent: number } = insurance;
      if (!insurance.provided && existing.length > 0) {
        const last = [...(existing as never as { date?: string; extension?: { url: string; valueString?: string; valueInteger?: number }[] }[])]
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
        const percent = last.extension?.find((e) => e.url === COVERAGE_EXTENSION_URL)?.valueInteger;
        if (percent) {
          coverage = { insurer: last.extension?.find((e) => e.url === INSURER_EXTENSION_URL)?.valueString, coveragePercent: percent };
        }
      }
      const lines = buildInvoiceLines(pending.serviceRequests, pending.dispenses, tariffs, {
        encounterId: id,
        includeConsultation: !state.consultationBilled,
      });
      const unpriced = lines.filter((line) => line.missingPrice).map((line) => line.description);
      if (unpriced.length > 0) {
        return reply.code(422).send({
          error: "Tarif manquant : renseignez le prix de ces éléments (onglet Tarifs) avant de facturer.",
          details: unpriced,
        });
      }
      const totals = computeTotals(lines, coverage.coveragePercent);
      const created = await hapiClient.post<{ id: string }>(
        "/Invoice",
        toFhirInvoice(patientId, patientName, id, lines, totals, tariffs.currency, coverage, request.user.name),
      );
      return reply.code(201).send({ invoice: await readInvoice(created.id) });
      });
    } catch (error) {
      return replyHapiError(reply, error, "Consultation introuvable.");
    }
  });
}
