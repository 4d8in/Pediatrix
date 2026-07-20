import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../lib/hapi-client.js";

const RESOURCE_TYPES = ["Patient", "Encounter", "Observation", "ServiceRequest", "DiagnosticReport"] as const;
const MAX_ENTRIES = 20;

interface FhirResource {
  resourceType: string;
  id: string;
  meta?: { lastUpdated?: string };
  [key: string]: unknown;
}

interface FhirBundle {
  entry?: { resource: FhirResource }[];
}

interface FhirLogEntry {
  type: string;
  id: string;
  lastUpdated: string | null;
  json: FhirResource;
}

// Vitrine d'interopérabilité : plutôt que la recherche whole-system de HAPI
// (`GET [base]?_type=...`), on interroge chaque type séparément — plus simple
// à expliquer et à déboguer dans ce prototype.
export async function fhirLogRoute(app: FastifyInstance) {
  app.get("/api/fhir-log", async (_request, reply) => {
    try {
      const bundles = await Promise.all(
        RESOURCE_TYPES.map((type) => hapiClient.get<FhirBundle>(`/${type}?_sort=-_lastUpdated&_count=5`)),
      );

      const entries: FhirLogEntry[] = bundles
        .flatMap((bundle) => bundle.entry ?? [])
        .map(({ resource }) => ({
          type: resource.resourceType,
          id: resource.id,
          lastUpdated: resource.meta?.lastUpdated ?? null,
          json: resource,
        }))
        .sort((a, b) => (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""))
        .slice(0, MAX_ENTRIES);

      return reply.send({ resources: entries });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
