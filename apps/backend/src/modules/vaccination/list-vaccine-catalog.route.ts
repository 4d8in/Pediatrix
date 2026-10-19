import type { FastifyInstance } from "fastify";
import { VACCINES } from "../../lib/vaccines.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

export async function listVaccineCatalogRoute(app: FastifyInstance) {
  app.get(
    "/api/vaccines/catalog",
    { preHandler: [authenticate, authorize("doctor", "nurse")] },
    async (_request, reply) => reply.send({ vaccines: VACCINES }),
  );
}
