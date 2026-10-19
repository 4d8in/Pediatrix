import type { FastifyInstance } from "fastify";
import { saveTariffs, validateTariffs } from "../../lib/tariffs.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

// La direction fixe les tarifs de l'établissement.
export async function putTariffsRoute(app: FastifyInstance) {
  app.put(
    "/api/billing/tariffs",
    { preHandler: [authenticate, authorize("director", "tech_admin")] },
    async (request, reply) => {
      const result = validateTariffs(request.body);
      if ("errors" in result) {
        return reply.code(400).send({ error: "Grille invalide.", details: result.errors });
      }
      await saveTariffs(result.tariffs);
      return reply.send({ tariffs: result.tariffs });
    },
  );
}
