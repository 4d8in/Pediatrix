import type { FastifyInstance } from "fastify";
import { startOfTodayIso } from "../lib/arrival.js";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import { type TriageCategory, TRIAGE_SYSTEM, latestTriageByEncounter, triageRank } from "../lib/triage.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";

// File active du jour, construite sur les arrivées (Encounter ambulatoire) :
// - "en_attente" : arrivé aujourd'hui, consultation pas encore faite (statut « arrived ») ;
// - "consulte"   : consultation faite aujourd'hui (statut « finished »).
// Les patients admis aujourd'hui avant l'introduction des arrivées (sans Encounter)
// restent listés « en attente », d'après la date de création de leur fiche.
// L'ordre de passage suit le tri : urgence, prioritaire, à trier, non urgent, puis heure d'arrivée.

interface FhirBundle {
  entry?: { resource: FhirResource }[];
}

interface FhirResource {
  resourceType?: string;
  id: string;
  status?: string;
  meta?: { lastUpdated?: string };
  name?: { family?: string; given?: string[] }[];
  birthDate?: string;
  gender?: string;
  subject?: { reference?: string };
  reasonCode?: { text?: string }[];
  period?: { start?: string };
  encounter?: { reference?: string };
  effectiveDateTime?: string;
  valueCodeableConcept?: { coding?: { code?: string }[] };
}

export interface QueueEntry {
  patientId: string;
  encounterId: string | null;
  name: string;
  birthDate: string | null;
  gender: string;
  admittedAt: string | null;
  status: "en_attente" | "consulte";
  reason: string | null;
  triage: TriageCategory | null;
}

export function buildQueue(
  encounters: FhirResource[],
  patients: FhirResource[],
  legacyPatients: FhirResource[],
  triageObservations: FhirResource[],
): QueueEntry[] {
  const patientById = new Map(patients.concat(legacyPatients).map((p) => [p.id, p]));
  const triage = latestTriageByEncounter(triageObservations);

  const describe = (patientId: string) => {
    const patient = patientById.get(patientId);
    const name = patient?.name?.[0];
    return {
      name: [name?.given?.[0], name?.family].filter(Boolean).join(" ") || "Patient",
      birthDate: patient?.birthDate ?? null,
      gender: patient?.gender ?? "unknown",
    };
  };

  // Une seule ligne par patient : l'arrivée en attente prime, sinon la dernière consultation.
  const byPatient = new Map<string, FhirResource>();
  for (const encounter of encounters) {
    const patientId = encounter.subject?.reference?.replace("Patient/", "");
    if (!patientId) continue;
    const current = byPatient.get(patientId);
    const better =
      !current ||
      (encounter.status === "arrived" && current.status !== "arrived") ||
      (encounter.status === current.status && (encounter.period?.start ?? "") > (current.period?.start ?? ""));
    if (better) byPatient.set(patientId, encounter);
  }

  const queue: QueueEntry[] = [...byPatient.entries()].map(([patientId, encounter]) => ({
    patientId,
    encounterId: encounter.id,
    ...describe(patientId),
    admittedAt: encounter.period?.start ?? null,
    status: encounter.status === "arrived" ? "en_attente" : "consulte",
    reason: encounter.reasonCode?.[0]?.text ?? null,
    triage: triage.get(encounter.id) ?? null,
  }));

  for (const patient of legacyPatients) {
    if (byPatient.has(patient.id)) continue;
    queue.push({
      patientId: patient.id,
      encounterId: null,
      ...describe(patient.id),
      admittedAt: patient.meta?.lastUpdated ?? null,
      status: "en_attente",
      reason: null,
      triage: null,
    });
  }

  return queue.sort(
    (a, b) =>
      (a.status === b.status ? 0 : a.status === "en_attente" ? -1 : 1) ||
      triageRank(a.triage) - triageRank(b.triage) ||
      (a.admittedAt ?? "").localeCompare(b.admittedAt ?? ""),
  );
}

export async function activeQueueRoute(app: FastifyInstance) {
  app.get(
    "/api/queue",
    { preHandler: [authenticate, authorize("nurse", "doctor", "receptionist", "director")] },
    async (_request, reply) => {
      try {
        const since = startOfTodayIso();
        const noCache = { "Cache-Control": "no-cache" };
        const [encounterBundle, legacyBundle, triageBundle] = await Promise.all([
          hapiClient.get<FhirBundle>(
            `/Encounter?class=AMB&date=ge${since}&_include=Encounter:subject&_count=200`,
            noCache,
          ),
          hapiClient.get<FhirBundle>(`/Patient?_lastUpdated=ge${since}&_sort=_lastUpdated&_count=200`, noCache),
          hapiClient.get<FhirBundle>(
            `/Observation?code=${encodeURIComponent(`${TRIAGE_SYSTEM}|triage-category`)}&date=ge${since}&_count=200`,
            noCache,
          ),
        ]);

        const resources = (encounterBundle.entry ?? []).map((e) => e.resource);
        const queue = buildQueue(
          resources.filter((r) => r.resourceType === "Encounter"),
          resources.filter((r) => r.resourceType === "Patient"),
          (legacyBundle.entry ?? []).map((e) => e.resource),
          (triageBundle.entry ?? []).map((e) => e.resource),
        );
        return reply.send({ queue });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
