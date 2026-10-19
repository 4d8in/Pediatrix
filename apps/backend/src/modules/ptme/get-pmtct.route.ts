import type { FastifyInstance } from "fastify";
import { PMTCT_CATEGORY_SEARCH_TOKEN, followUp } from "../../lib/pmtct.js";
import { fetchAll } from "../../lib/fhir-search.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fromPmtctBundle } from "./pmtct.fhir.js";

// Suivi PTME d'un enfant (null s'il n'est pas inscrit) : donnée de santé très sensible, soignants seulement.
export async function getPmtctRoute(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/patients/:id/ptme",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      if (!isSafeId(request.params.id)) return reply.code(404).send({ error: "Patient introuvable." });
      try {
        const patient = await hapiClient.get<{ birthDate?: string }>(`/Patient/${request.params.id}`);
        const observations = await fetchAll<never>(
          `/Observation?patient=${request.params.id}&category=${encodeURIComponent(PMTCT_CATEGORY_SEARCH_TOKEN)}`,
        );
        const { enrolment, results } = fromPmtctBundle({ entry: observations.map((resource) => ({ resource })) });
        if (!enrolment) return reply.send({ ptme: null });
        return reply.send({ ptme: { enrolment, ...followUp(patient.birthDate ?? "", results) } });
      } catch (error) {
        if (error instanceof HapiError) {
          const status = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(status).send({ error: error.statusCode === 404 ? "Patient introuvable." : error.message });
        }
        throw error;
      }
    },
  );
}
