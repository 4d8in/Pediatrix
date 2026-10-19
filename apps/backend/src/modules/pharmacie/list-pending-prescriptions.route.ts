import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  medicationCodeableConcept?: { text?: string };
  subject?: { reference?: string };
  authoredOn?: string;
  dosageInstruction?: { text?: string }[];
}

interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: { family?: string; given?: string[] }[];
}

interface FhirBundle {
  entry?: { resource: FhirMedicationRequest | FhirPatient }[];
}

export interface PendingPrescription {
  id: string;
  patientId: string;
  patientName: string;
  medication: string | null;
  dosage: string | null;
  authoredOn: string | null;
}

export function parsePendingPrescriptions(bundle: FhirBundle): PendingPrescription[] {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource);
  const requests = resources.filter((r): r is FhirMedicationRequest => r.resourceType === "MedicationRequest");
  const patients = resources.filter((r): r is FhirPatient => r.resourceType === "Patient");

  return requests
    .map((mr): PendingPrescription => {
      const patientId = mr.subject?.reference?.split("/")[1] ?? "";
      const name = patients.find((p) => p.id === patientId)?.name?.[0];
      return {
        id: mr.id,
        patientId,
        patientName: name ? `${name.given?.[0] ?? ""} ${name.family ?? ""}`.trim() : "",
        medication: mr.medicationCodeableConcept?.text ?? null,
        dosage: mr.dosageInstruction?.[0]?.text ?? null,
        authoredOn: mr.authoredOn ?? null,
      };
    })
    .sort((a, b) => (a.authoredOn ?? "").localeCompare(b.authoredOn ?? ""));
}

// Ordonnances actives, pas encore délivrées : les plus anciennes d'abord.
export async function listPendingPrescriptionsRoute(app: FastifyInstance) {
  app.get(
    "/api/pharmacy/prescriptions",
    { preHandler: [authenticate, authorize("pharmacist")] },
    async (request, reply) => {
      const { status } = request.query as { status?: string };
      const requestStatus = status === "completed" ? "completed" : "active";
      try {
        // À délivrer : les plus anciennes d'abord, pour que celles qui attendent depuis le plus
        // longtemps ne soient jamais écartées par la limite de page ; historique : les plus récentes.
        const sort = requestStatus === "active" ? "authoredon" : "-authoredon";
        const bundle = await hapiClient.get<FhirBundle>(
          `/MedicationRequest?status=${requestStatus}&_include=MedicationRequest:subject&_count=200&_sort=${sort}`,
          { "Cache-Control": "no-cache" },
        );
        return reply.send({ prescriptions: parsePendingPrescriptions(bundle) });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
