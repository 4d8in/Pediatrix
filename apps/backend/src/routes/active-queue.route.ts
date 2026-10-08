import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";

// File active du jour : patients admis aujourd'hui, avec leur statut.
// - "en_attente" : admis aujourd'hui, pas encore de consultation aujourd'hui ;
// - "consulte"   : au moins une consultation (Encounter) aujourd'hui.
// Le socle ne stocke pas d'heure d'admission explicite : on utilise la date de
// création de la ressource Patient (meta.lastUpdated), fiable tant que la fiche
// n'est pas modifiée ensuite (l'application ne modifie jamais un Patient).

interface FhirBundle {
  entry?: { resource: FhirResource }[];
}

interface FhirResource {
  id: string;
  meta?: { lastUpdated?: string };
  name?: { family?: string; given?: string[] }[];
  birthDate?: string;
  gender?: string;
  subject?: { reference?: string };
  reasonCode?: { text?: string }[];
  period?: { start?: string };
}

function startOfTodayIso(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function activeQueueRoute(app: FastifyInstance) {
  app.get(
    "/api/queue",
    { preHandler: [authenticate, authorize("nurse", "doctor", "director")] },
    async (_request, reply) => {
      try {
        const since = startOfTodayIso(new Date());
        const noCache = { "Cache-Control": "no-cache" };
        const [patientsBundle, encountersBundle] = await Promise.all([
          hapiClient.get<FhirBundle>(`/Patient?_lastUpdated=ge${since}&_sort=_lastUpdated&_count=200`, noCache),
          hapiClient.get<FhirBundle>(`/Encounter?class=AMB&date=ge${since.slice(0, 10)}&_count=200`, noCache),
        ]);

        // Dernière consultation du jour par patient.
        const encounterByPatient = new Map<string, FhirResource>();
        for (const { resource } of encountersBundle.entry ?? []) {
          const patientId = resource.subject?.reference?.replace("Patient/", "");
          if (patientId) encounterByPatient.set(patientId, resource);
        }

        const queue = (patientsBundle.entry ?? []).map(({ resource }) => {
          const encounter = encounterByPatient.get(resource.id);
          const name = resource.name?.[0];
          return {
            patientId: resource.id,
            name: [name?.given?.[0], name?.family].filter(Boolean).join(" ") || "Patient",
            birthDate: resource.birthDate ?? null,
            gender: resource.gender ?? "unknown",
            admittedAt: resource.meta?.lastUpdated ?? null,
            status: encounter ? "consulte" : "en_attente",
            reason: encounter?.reasonCode?.[0]?.text ?? null,
          };
        });

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
