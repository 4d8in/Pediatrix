import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { type FhirImmunization, toFhirImmunization } from "./immunization.fhir.js";
import type { CreateImmunizationInput } from "./immunization.types.js";

function validate(body: unknown): { input: CreateImmunizationInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const vaccine = typeof b.vaccine === "string" ? b.vaccine.trim() : "";
  const date = typeof b.date === "string" ? b.date.trim() : "";
  const notes = typeof b.notes === "string" ? b.notes.trim() : "";
  const doseNumber =
    typeof b.doseNumber === "number" && Number.isInteger(b.doseNumber) && b.doseNumber > 0
      ? b.doseNumber
      : undefined;

  if (!vaccine) errors.push("Le nom du vaccin est requis.");
  if (!date) errors.push("La date d'administration est requise.");

  if (errors.length > 0) return { errors };

  return { input: { vaccine, date, doseNumber, notes: notes || undefined } };
}

export async function createImmunizationRoute(app: FastifyInstance) {
  app.post(
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

      const result = validate(request.body);
      if ("errors" in result) {
        return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
      }

      try {
        const created = await hapiClient.post<FhirImmunization>(
          "/Immunization",
          toFhirImmunization(id, result.input),
        );
        return reply.code(201).send({ immunizationId: created.id });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
