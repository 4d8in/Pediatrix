import type { FastifyInstance } from "fastify";
import { BIRTH_CATEGORY_SEARCH_TOKEN, validateBirth } from "../../lib/birth.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { withLock } from "../../lib/keyed-lock.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { toBirthBundle } from "./birth.fhir.js";

// Enregistre les données de naissance (une seule fois par enfant).
export async function createBirthRoute(app: FastifyInstance) {
  app.post(
    "/api/patients/:id/birth",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isSafeId(id)) return reply.code(404).send({ error: "Patient introuvable." });
      const result = validateBirth(request.body);
      if ("errors" in result) return reply.code(400).send({ error: "Requête invalide.", details: result.errors });

      try {
        await hapiClient.get(`/Patient/${id}`);
      } catch (error) {
        if (error instanceof HapiError) {
          const status = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(status).send({ error: error.statusCode === 404 ? "Patient introuvable." : error.message });
        }
        throw error;
      }

      try {
        return await withLock(`birth:${id}`, async () => {
          const existing = await hapiClient.get<{ entry?: unknown[] }>(
            `/Observation?patient=${id}&category=${encodeURIComponent(BIRTH_CATEGORY_SEARCH_TOKEN)}&_count=1`,
            { "Cache-Control": "no-cache" },
          );
          if ((existing.entry ?? []).length > 0) {
            return reply.code(409).send({ error: "Les données de naissance de cet enfant sont déjà enregistrées." });
          }
          await hapiClient.post("", toBirthBundle(id, result.input, new Date().toISOString()));
          return reply.code(201).send({ ok: true });
        });
      } catch (error) {
        if (error instanceof HapiError) return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        throw error;
      }
    },
  );
}
