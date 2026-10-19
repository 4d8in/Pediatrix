import type { FastifyInstance } from "fastify";
import { hapiClient } from "../../lib/hapi-client.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fromFhirAdministrations } from "./administration.fhir.js";
import { hapiErrorReply } from "./stay-store.js";

// Administrations enregistrées pendant un séjour, de la plus récente à la plus ancienne.
export async function listAdministrationsRoute(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/hospitalisations/:id/administrations",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      if (!isSafeId(request.params.id)) return reply.code(404).send({ error: "Séjour introuvable." });
      try {
        const bundle = await hapiClient.get<{ entry?: { resource: never }[] }>(
          `/MedicationAdministration?context=Encounter/${request.params.id}&_sort=-effective-time&_count=200`,
          { "Cache-Control": "no-cache" },
        );
        return reply.send({ administrations: fromFhirAdministrations(bundle) });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
