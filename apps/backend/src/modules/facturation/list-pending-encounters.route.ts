import type { FastifyInstance } from "fastify";
import { fetchAll } from "../../lib/fhir-search.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { INVOICE_ENCOUNTER_SYSTEM, billedState, unbilledItems } from "./billing.fhir.js";
import { replyHapiError } from "./billing-errors.js";

interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  subject?: { reference?: string };
  reasonCode?: { text?: string }[];
  period?: { start?: string };
}
interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: { family?: string; given?: string[] }[];
}
interface FhirInvoice {
  date?: string;
  identifier?: { system?: string; value?: string }[];
}
interface FhirOrder {
  id?: string;
  status?: string;
  authoredOn?: string;
  whenHandedOver?: string;
  encounter?: { reference?: string };
  context?: { reference?: string };
}

// Fenêtre de la liste « à facturer » (jours), réglable par BILLING_WINDOW_DAYS (défaut 30).
const WINDOW_DAYS = Math.min(Math.max(Number(process.env.BILLING_WINDOW_DAYS) || 30, 1), 365);

// Consultations récentes à facturer : jamais facturées, ou avec des examens / médicaments ajoutés
// après la facture (facture complémentaire).
export async function listPendingEncountersRoute(app: FastifyInstance) {
  app.get("/api/billing/encounters", { preHandler: [authenticate, authorize("cashier")] }, async (_request, reply) => {
    try {
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
      const [resources, invoices, serviceRequests, dispenses] = await Promise.all([
        fetchAll<FhirEncounter | FhirPatient>(
          `/Encounter?class=AMB&status=finished&date=ge${since}&_include=Encounter:subject&_sort=-date`,
        ),
        fetchAll<FhirInvoice>(`/Invoice?date=ge${since}`),
        fetchAll<FhirOrder>(`/ServiceRequest?authored=ge${since}`),
        fetchAll<FhirOrder>(`/MedicationDispense?status=completed&whenhandedover=ge${since}`),
      ]);
      const encounterIdOf = (ref?: string) => ref?.split("/")[1];
      const invoicesOf = (encounterId: string) =>
        invoices.filter((inv) =>
          (inv.identifier ?? []).some((i) => i.system === INVOICE_ENCOUNTER_SYSTEM && i.value === encounterId),
        );
      const patients = resources.filter((r): r is FhirPatient => r.resourceType === "Patient");

      const encounters = resources
        .filter((r): r is FhirEncounter => r.resourceType === "Encounter")
        .flatMap((e) => {
          const state = billedState(invoicesOf(e.id));
          const pending = unbilledItems(
            state,
            serviceRequests.filter((sr) => encounterIdOf(sr.encounter?.reference) === e.id),
            dispenses.filter((d) => encounterIdOf(d.context?.reference) === e.id),
          );
          const unbilledCount = pending.serviceRequests.length + pending.dispenses.length;
          if (state.consultationBilled && unbilledCount === 0) return [];
          const patientId = e.subject?.reference?.split("/")[1] ?? "";
          const name = patients.find((p) => p.id === patientId)?.name?.[0];
          return [
            {
              encounterId: e.id,
              patientId,
              patientName: name ? `${name.given?.[0] ?? ""} ${name.family ?? ""}`.trim() : "",
              reason: e.reasonCode?.[0]?.text ?? null,
              date: e.period?.start ?? null,
              supplementary: state.consultationBilled,
              unbilledCount,
            },
          ];
        });
      return reply.send({ encounters });
    } catch (error) {
      return replyHapiError(reply, error);
    }
  });
}
