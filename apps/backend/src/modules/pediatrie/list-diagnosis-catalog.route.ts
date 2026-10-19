import type { FastifyInstance } from "fastify";
import { DIAGNOSES } from "../../lib/diagnoses.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

export async function listDiagnosisCatalogRoute(app: FastifyInstance) {
  app.get(
    "/api/diagnoses/catalog",
    { preHandler: [authenticate, authorize("doctor", "director")] },
    async (_request, reply) => reply.send({ diagnoses: DIAGNOSES }),
  );
}
