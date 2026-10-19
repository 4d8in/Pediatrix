import type { FastifyInstance } from "fastify";
import { PMTCT_CATEGORY_SEARCH_TOKEN, validateTest } from "../../lib/pmtct.js";
import { fetchAll } from "../../lib/fhir-search.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { withLock } from "../../lib/keyed-lock.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fromPmtctBundle, toTestObservation } from "./pmtct.fhir.js";

// Enregistre le résultat d'un dépistage du calendrier PTME (un résultat par jalon).
export async function recordPmtctTestRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/patients/:id/ptme/tests",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      if (!isSafeId(request.params.id)) return reply.code(404).send({ error: "Patient introuvable." });
      const result = validateTest(request.body);
      if ("errors" in result) return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
      try {
        return await withLock(`pmtct:${request.params.id}`, async () => {
          const observations = await fetchAll<never>(
            `/Observation?patient=${request.params.id}&category=${encodeURIComponent(PMTCT_CATEGORY_SEARCH_TOKEN)}`,
          );
          const { enrolment, results } = fromPmtctBundle({ entry: observations.map((resource) => ({ resource })) });
          if (!enrolment) return reply.code(409).send({ error: "Cet enfant n'est pas inscrit au suivi PTME." });
          if (results.some((r) => r.milestone === result.input.milestone)) {
            return reply.code(409).send({ error: "Le résultat de ce jalon est déjà enregistré." });
          }
          await hapiClient.post(
            "/Observation",
            toTestObservation(request.params.id, result.input.milestone, result.input.result, new Date().toISOString(), request.user.name),
          );
          return reply.code(201).send({ ok: true });
        });
      } catch (error) {
        if (error instanceof HapiError) {
          const status = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(status).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
