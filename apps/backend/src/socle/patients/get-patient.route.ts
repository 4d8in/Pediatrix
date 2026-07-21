import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { VITAL_LOINC_CODES, type VitalKey } from "../../lib/vitals-codes.js";
import { authenticate } from "../auth/authenticate.js";
import { authorize } from "../auth/authorize.js";
import { type FhirPatient, fromFhirPatient } from "./patient.fhir.js";

const READ_ROLES = ["nurse", "doctor", "lab_tech", "director"] as const;

interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  period?: { start?: string };
  reasonCode?: { text?: string }[];
}

interface FhirObservation {
  resourceType: "Observation";
  encounter?: { reference?: string };
  code?: { coding?: { code?: string }[] };
  valueQuantity?: { value?: number };
  valueString?: string;
}

interface FhirBundle {
  entry?: { resource: FhirEncounter | FhirObservation }[];
}

interface ConsultationSummary {
  id: string;
  date: string | null;
  reason: string | null;
  notes: string | null;
  vitals: Partial<Record<VitalKey, number>>;
}

const LOINC_TO_VITAL_KEY: Record<string, VitalKey> = Object.fromEntries(
  (Object.entries(VITAL_LOINC_CODES) as [VitalKey, { code: string }][]).map(([key, meta]) => [meta.code, key]),
);

function parseConsultations(bundle: FhirBundle): ConsultationSummary[] {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource);
  const encounters = resources.filter((r): r is FhirEncounter => r.resourceType === "Encounter");
  const observations = resources.filter((r): r is FhirObservation => r.resourceType === "Observation");

  return encounters
    .map((encounter): ConsultationSummary => {
      const encounterRef = `Encounter/${encounter.id}`;
      const linked = observations.filter((o) => o.encounter?.reference === encounterRef);

      const vitals: Partial<Record<VitalKey, number>> = {};
      let notes: string | null = null;

      for (const obs of linked) {
        const loincCode = obs.code?.coding?.[0]?.code;
        const vitalKey = loincCode ? LOINC_TO_VITAL_KEY[loincCode] : undefined;
        if (vitalKey && obs.valueQuantity?.value !== undefined) {
          vitals[vitalKey] = obs.valueQuantity.value;
        } else if (obs.valueString) {
          notes = obs.valueString;
        }
      }

      return {
        id: encounter.id,
        date: encounter.period?.start ?? null,
        reason: encounter.reasonCode?.[0]?.text ?? null,
        notes,
        vitals,
      };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export async function getPatientRoute(app: FastifyInstance) {
  app.get("/api/patients/:id", { preHandler: [authenticate, authorize(...READ_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const patientResource = await hapiClient.get<FhirPatient>(`/Patient/${id}`);
      const patient = fromFhirPatient(patientResource);

      const bundle = await hapiClient.get<FhirBundle>(
        `/Encounter?patient=${id}&_revinclude=Observation:encounter&_sort=-date`,
      );
      const consultations = parseConsultations(bundle);

      return reply.send({ patient, consultations });
    } catch (error) {
      if (error instanceof HapiError) {
        const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
        const message = error.statusCode === 404 ? "Patient introuvable." : error.message;
        return reply.code(statusCode).send({ error: message });
      }
      throw error;
    }
  });
}
