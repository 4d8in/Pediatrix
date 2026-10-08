import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import { VITAL_LOINC_CODES } from "../lib/vitals-codes.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";

const VITALS_CODES = Object.values(VITAL_LOINC_CODES)
  .map((meta) => meta.code)
  .join(",");

interface FhirBundlePage<T> {
  entry?: { resource: T }[];
  link?: { relation?: string; url?: string }[];
}

// Pagine une recherche HAPI et retourne toutes les entrées — même motif que
// stats.route.ts::countExamensParType (pas de whole-system search), dupliqué
// localement plutôt qu'importé pour garder cette route isolée de /api/stats.
// Cache-Control: no-cache : même raison que list-lab-requests.route.ts et
// stats.route.ts (fraîcheur immédiate après une création).
async function fetchAllEntries<T>(path: string): Promise<T[]> {
  const resources: T[] = [];
  let bundle = await hapiClient.get<FhirBundlePage<T>>(path, { "Cache-Control": "no-cache" });

  while (true) {
    resources.push(...(bundle.entry ?? []).map((entry) => entry.resource));

    const nextUrl = bundle.link?.find((link) => link.relation === "next")?.url;
    if (!nextUrl) break;

    const response = await fetch(nextUrl, {
      headers: { Accept: "application/fhir+json", "Cache-Control": "no-cache" },
    });
    if (!response.ok) {
      throw new HapiError(response.status, `HAPI a répondu ${response.status} lors de la pagination.`);
    }
    bundle = (await response.json()) as FhirBundlePage<T>;
  }

  return resources;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayRange(now: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: toDateOnly(start), end: toDateOnly(end) };
}

interface FhirEncounterElement {
  resourceType: "Encounter";
  id: string;
}

interface FhirObservationElement {
  resourceType: "Observation";
  encounter?: { reference?: string };
}

function unavailable(raison: string) {
  return { disponible: false as const, raison };
}

export async function dashboardCountersRoute(app: FastifyInstance) {
  app.get(
    "/api/dashboard/counters",
    { preHandler: [authenticate, authorize("nurse", "doctor", "director")] },
    async (_request, reply) => {
      try {
        const { start, end } = todayRange(new Date());

        // Consultations du jour sans aucune Observation de vitaux (codes LOINC
        // dédiés, voir vitals-codes.ts) : les vitaux sont un sous-ensemble
        // optionnel de la consultation (see encounter.fhir.ts), donc calculable
        // par différence d'ensembles entre Encounter du jour et Observations de
        // vitaux du jour, sans supposer de modèle absent du socle.
        const [encountersToday, vitalsObservationsToday] = await Promise.all([
          fetchAllEntries<FhirEncounterElement>(
            `/Encounter?class=AMB&date=ge${start}&date=lt${end}&_elements=id&_count=100`,
          ),
          fetchAllEntries<FhirObservationElement>(
            `/Observation?code=${VITALS_CODES}&date=ge${start}&date=lt${end}&_elements=encounter&_count=100`,
          ),
        ]);

        const encounterIdsToday = encountersToday.map((e) => e.id);
        const encounterIdsWithVitals = new Set(
          vitalsObservationsToday
            .map((o) => o.encounter?.reference?.split("/")[1])
            .filter((id): id is string => Boolean(id)),
        );

        const parametresVitauxAPrendre = encounterIdsToday.filter((id) => !encounterIdsWithVitals.has(id)).length;

        return reply.send({
          parametresVitauxAPrendre,
          hospitalises: unavailable(
            "Aucune notion d'admission/décharge dans le socle FHIR actuel (pas de champ dischargeDateTime).",
          ),
        });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
