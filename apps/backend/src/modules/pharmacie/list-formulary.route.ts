import type { FastifyInstance } from "fastify";
import { FORMULARY } from "../../lib/formulary.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

// Formulaire de l'établissement : lu par le pharmacien (délivrance, réception)
// et par le médecin (suggestions à la prescription).
export async function listFormularyRoute(app: FastifyInstance) {
  app.get(
    "/api/pharmacy/formulary",
    { preHandler: [authenticate, authorize("pharmacist", "doctor")] },
    async (_request, reply) => reply.send({ items: FORMULARY }),
  );
}
