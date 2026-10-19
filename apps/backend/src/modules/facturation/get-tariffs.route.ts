import type { FastifyInstance } from "fastify";
import { FORMULARY } from "../../lib/formulary.js";
import { loadTariffs } from "../../lib/tariffs.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

// Grille tarifaire, avec les articles du formulaire pour l'écran d'édition.
export async function getTariffsRoute(app: FastifyInstance) {
  app.get(
    "/api/billing/tariffs",
    { preHandler: [authenticate, authorize("cashier", "director", "tech_admin")] },
    async (_request, reply) =>
      reply.send({ tariffs: await loadTariffs(), items: FORMULARY.map(({ code, name, unit }) => ({ code, name, unit })) }),
  );
}
