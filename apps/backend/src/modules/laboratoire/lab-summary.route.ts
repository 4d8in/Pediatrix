import type { FastifyInstance } from "fastify";
import { HapiError } from "../../lib/hapi-client.js";
import { computeRequestSummary } from "../../lib/request-summary.js";
import { IMAGING_CATEGORY_SEARCH_TOKEN } from "../../lib/service-category.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

// Compteurs du jour du laboratoire (hors imagerie, même filtre que la file labo).
export async function labSummaryRoute(app: FastifyInstance) {
  app.get("/api/lab/summary", { preHandler: [authenticate, authorize("lab_tech")] }, async (_request, reply) => {
    try {
      return reply.send(await computeRequestSummary(`category:not=${IMAGING_CATEGORY_SEARCH_TOKEN}`));
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
