import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { type FhirAllergyIntolerance, toFhirAllergyIntolerance } from "./allergy.fhir.js";
import type { CreateAllergyInput } from "./allergy.types.js";

function validate(body: unknown): { input: CreateAllergyInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const substance = typeof b.substance === "string" ? b.substance.trim() : "";
  const reaction = typeof b.reaction === "string" ? b.reaction.trim() : "";

  if (!substance) errors.push("La substance allergène est requise.");

  if (errors.length > 0) return { errors };

  return { input: { substance, reaction: reaction || undefined } };
}

export async function createAllergyRoute(app: FastifyInstance) {
  app.post(
    "/api/patients/:id/allergies",
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

      const result = validate(request.body);
      if ("errors" in result) {
        return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
      }

      try {
        const created = await hapiClient.post<FhirAllergyIntolerance>(
          "/AllergyIntolerance",
          toFhirAllergyIntolerance(id, result.input),
        );
        return reply.code(201).send({ allergyId: created.id });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
