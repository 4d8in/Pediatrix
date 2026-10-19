import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { createArrival, findTodayArrival } from "../../lib/arrival.js";

// Enregistre l'arrivée d'un patient déjà connu : il entre dans la file active du jour.
export async function checkInRoute(app: FastifyInstance) {
  app.post(
    "/api/patients/:id/arrival",
    { preHandler: [authenticate, authorize("nurse", "doctor", "receptionist")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await hapiClient.get(`/Patient/${id}`);
        if (await findTodayArrival(id)) {
          return reply.code(409).send({ error: "Ce patient est déjà dans la file active du jour." });
        }
        return reply.code(201).send({ encounterId: await createArrival(id) });
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({ error: error.statusCode === 404 ? "Patient introuvable." : error.message });
        }
        throw error;
      }
    },
  );
}
