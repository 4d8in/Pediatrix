import type { FastifyInstance } from "fastify";
import { hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import type { FhirLocation, FhirStay } from "./beds.fhir.js";
import { hapiErrorReply } from "./stay-store.js";

interface FhirBundle {
  entry?: { resource: FhirStay | FhirLocation }[];
}

// Séjours (en cours et passés) d'un patient, avec l'historique des lits occupés.
export async function listPatientStaysRoute(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/patients/:id/stays",
    { preHandler: [authenticate, authorize("nurse", "doctor", "lab_tech", "radiologist", "director")] },
    async (request, reply) => {
      try {
        const bundle = await hapiClient.get<FhirBundle>(
          `/Encounter?patient=${encodeURIComponent(request.params.id)}&class=IMP&_include=Encounter:location&_sort=-date&_count=50`,
          { "Cache-Control": "no-cache" },
        );
        const resources = (bundle.entry ?? []).map((entry) => entry.resource);
        const beds = new Map(
          resources
            .filter((r): r is FhirLocation => r.resourceType === "Location")
            .map((location) => [location.id, location.name ?? location.id]),
        );

        const stays = resources
          .filter((r): r is FhirStay => r.resourceType === "Encounter")
          .map((stay) => ({
            id: stay.id,
            inProgress: stay.status === "in-progress",
            start: stay.period?.start ?? null,
            end: stay.period?.end ?? null,
            reason: stay.reasonCode?.[0]?.text ?? null,
            beds: (stay.location ?? []).map((entry) => {
              const bedId = entry.location?.reference?.replace("Location/", "") ?? "";
              return { name: beds.get(bedId) ?? bedId, start: entry.period?.start ?? null, end: entry.period?.end ?? null };
            }),
          }));

        return reply.send({ stays });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
