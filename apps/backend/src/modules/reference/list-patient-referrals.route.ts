import type { FastifyInstance } from "fastify";
import { fetchAll } from "../../lib/fhir-search.js";
import { HapiError } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { REFERRAL_SEARCH_TOKEN, summarizeReferral } from "./referral.fhir.js";

const READ_ROLES = ["nurse", "doctor"] as const;

export async function listPatientReferralsRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/referrals",
    { preHandler: [authenticate, authorize(...READ_ROLES)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const communications = await fetchAll<Record<string, unknown>>(
          `/Communication?patient=${id}&category=${encodeURIComponent(REFERRAL_SEARCH_TOKEN)}`,
        );
        const referrals = communications
          .map((c) => summarizeReferral(c as never))
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        return reply.send({ referrals });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
