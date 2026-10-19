import type { FastifyInstance } from "fastify";
import { fetchAll } from "../../lib/fhir-search.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { INVOICE_ENCOUNTER_SYSTEM } from "./billing.fhir.js";
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
  identifier?: { system?: string; value?: string }[];
}

const WINDOW_DAYS = 14;

// Consultations récentes pas encore facturées.
export async function listPendingEncountersRoute(app: FastifyInstance) {
  app.get("/api/billing/encounters", { preHandler: [authenticate, authorize("cashier")] }, async (_request, reply) => {
    try {
      const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
      const [resources, invoices] = await Promise.all([
        fetchAll<FhirEncounter | FhirPatient>(
          `/Encounter?class=AMB&status=finished&date=ge${since}&_include=Encounter:subject&_sort=-date`,
        ),
        fetchAll<FhirInvoice>("/Invoice"),
      ]);
      const billed = new Set(
        invoices.flatMap((inv) =>
          (inv.identifier ?? []).filter((i) => i.system === INVOICE_ENCOUNTER_SYSTEM).map((i) => i.value),
        ),
      );
      const patients = resources.filter((r): r is FhirPatient => r.resourceType === "Patient");

      const encounters = resources
        .filter((r): r is FhirEncounter => r.resourceType === "Encounter" && !billed.has(r.id))
        .map((e) => {
          const patientId = e.subject?.reference?.split("/")[1] ?? "";
          const name = patients.find((p) => p.id === patientId)?.name?.[0];
          return {
            encounterId: e.id,
            patientId,
            patientName: name ? `${name.given?.[0] ?? ""} ${name.family ?? ""}`.trim() : "",
            reason: e.reasonCode?.[0]?.text ?? null,
            date: e.period?.start ?? null,
          };
        });
      return reply.send({ encounters });
    } catch (error) {
      return replyHapiError(reply, error);
    }
  });
}
