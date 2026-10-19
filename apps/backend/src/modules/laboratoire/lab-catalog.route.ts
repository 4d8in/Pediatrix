import type { FastifyInstance } from "fastify";
import { LAB_CATALOG } from "../../lib/lab-catalog.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

// Catalogue des examens, lu par le médecin (demande) et le technicien (saisie).
export async function labCatalogRoute(app: FastifyInstance) {
  app.get(
    "/api/lab/catalog",
    { preHandler: [authenticate, authorize("doctor", "lab_tech")] },
    async (_request, reply) => reply.send({ tests: LAB_CATALOG }),
  );
}
