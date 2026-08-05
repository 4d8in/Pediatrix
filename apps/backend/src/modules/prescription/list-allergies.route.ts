import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { type FhirAllergyIntolerance, fromFhirAllergyBundle } from "./allergy.fhir.js";

const READ_ROLES = ["nurse", "doctor", "lab_tech", "director"] as const;

interface FhirBundle {
  entry?: { resource: FhirAllergyIntolerance }[];
}

export async function listAllergiesRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/allergies",
    { preHandler: [authenticate, authorize(...READ_ROLES)] },
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
        const bundle = await hapiClient.get<FhirBundle>(
          `/AllergyIntolerance?patient=${id}&clinical-status=active`,
          { "Cache-Control": "no-cache" },
        );
        return reply.send({ allergies: fromFhirAllergyBundle(bundle) });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
