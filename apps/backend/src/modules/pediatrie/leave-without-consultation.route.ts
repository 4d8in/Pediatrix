import type { FastifyInstance } from "fastify";
import { findTodayArrival } from "../../lib/arrival.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

// Patient parti sans avoir été vu : l'arrivée du jour passe à « cancelled » et sort de la file,
// sans être comptée comme une consultation dans les statistiques.
export async function leaveWithoutConsultationRoute(app: FastifyInstance) {
  app.post(
    "/api/patients/:id/arrival/left",
    { preHandler: [authenticate, authorize("nurse", "doctor", "receptionist")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const arrival = await findTodayArrival(id);
        if (!arrival) return reply.code(404).send({ error: "Aucune arrivée en attente pour ce patient aujourd'hui." });
        await hapiClient.put(`/Encounter/${arrival.id}`, { ...arrival, status: "cancelled" });
        return reply.send({ encounterId: arrival.id });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
