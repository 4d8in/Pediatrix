import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import type { FhirImmunization } from "./immunization.fhir.js";
import { fromFhirImmunizationBundle } from "./immunization.fhir.js";

interface FhirBundle {
  entry?: { resource: FhirImmunization }[];
}

export async function listImmunizationsRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/immunizations",
    { preHandler: [authenticate, authorize("doctor", "nurse")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await hapiClient.get(`/Patient/${id}`);
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          const message = error.statusCode === 404 ? "Patient introuvable." : error.message;
          return reply.code(statusCode).send({ error: message });
        }
        throw error;
      }

      try {
        const bundle = await hapiClient.get<FhirBundle>(`/Immunization?patient=${id}&_sort=-date`, {
          "Cache-Control": "no-cache",
        });
        return reply.send({ immunizations: fromFhirImmunizationBundle(bundle) });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
