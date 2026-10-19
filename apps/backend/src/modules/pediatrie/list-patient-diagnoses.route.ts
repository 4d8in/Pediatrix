import type { FastifyInstance } from "fastify";
import { fetchAll } from "../../lib/fhir-search.js";
import { HapiError } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { summarizeCondition } from "./diagnosis.fhir.js";

const READ_ROLES = ["nurse", "doctor", "director"] as const;

export async function listPatientDiagnosesRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/diagnoses",
    { preHandler: [authenticate, authorize(...READ_ROLES)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const conditions = await fetchAll<Record<string, unknown>>(`/Condition?patient=${id}&_sort=-recorded-date`);
        const diagnoses = conditions
          .map((c) => summarizeCondition(c as never))
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        return reply.send({ diagnoses });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
