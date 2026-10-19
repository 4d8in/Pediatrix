import type { FastifyInstance } from "fastify";
import { BIRTH_CATEGORY_SEARCH_TOKEN } from "../../lib/birth.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fromBirthBundle } from "./birth.fhir.js";

// Registre de naissance d'un enfant (null s'il n'a pas été saisi).
export async function getBirthRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/birth",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isSafeId(id)) return reply.code(404).send({ error: "Patient introuvable." });
      try {
        const bundle = await hapiClient.get<{ entry?: { resource: never }[] }>(
          `/Observation?patient=${id}&category=${encodeURIComponent(BIRTH_CATEGORY_SEARCH_TOKEN)}&_count=20`,
          { "Cache-Control": "no-cache" },
        );
        return reply.send({ birth: fromBirthBundle(bundle) });
      } catch (error) {
        if (error instanceof HapiError) return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        throw error;
      }
    },
  );
}
