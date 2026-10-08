import type { FastifyInstance } from "fastify";
import { PLAUSIBLE_RANGES, checkPastDate, checkRange } from "../../lib/validation.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { parseGrowthTransactionResponse, toGrowthTransactionBundle } from "./growth.fhir.js";
import type { CreateGrowthInput } from "./growth.types.js";

interface TransactionResponseBundle {
  entry?: { response?: { location?: string } }[];
}

function validate(body: unknown): { input: CreateGrowthInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const date = typeof b.date === "string" ? b.date.trim() : "";
  const weight = typeof b.weight === "number" ? b.weight : undefined;
  const height = typeof b.height === "number" ? b.height : undefined;
  const headCircumference = typeof b.headCircumference === "number" ? b.headCircumference : undefined;

  if (!date) {
    errors.push("La date de la mesure est requise.");
  } else {
    const dateError = checkPastDate(date, "La date de la mesure");
    if (dateError) errors.push(dateError);
  }
  const measures: [number | undefined, keyof typeof PLAUSIBLE_RANGES, string][] = [
    [weight, "weight", "Le poids"],
    [height, "height", "La taille"],
    [headCircumference, "headCircumference", "Le périmètre crânien"],
  ];
  for (const [value, key, label] of measures) {
    if (value === undefined) continue;
    const rangeError = checkRange(value, PLAUSIBLE_RANGES[key], label);
    if (rangeError) errors.push(rangeError);
  }
  if (weight === undefined && height === undefined && headCircumference === undefined) {
    errors.push("Au moins une mesure (poids, taille ou périmètre crânien) est requise.");
  }

  if (errors.length > 0) return { errors };

  return { input: { date, weight, height, headCircumference } };
}

export async function createGrowthRoute(app: FastifyInstance) {
  app.post(
    "/api/patients/:id/growth",
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
        const responseBundle = await hapiClient.post<TransactionResponseBundle>(
          "",
          toGrowthTransactionBundle(id, result.input),
        );
        const { observationIds } = parseGrowthTransactionResponse(responseBundle);
        return reply.code(201).send({ observationIds });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
