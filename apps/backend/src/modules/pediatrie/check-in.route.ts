import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { createArrival, findTodayArrival } from "../../lib/arrival.js";
import { KEY_PATTERN } from "../../lib/idempotency.js";
import { parseOccurredAt } from "../../lib/occurred-at.js";

// Enregistre l'arrivée d'un patient déjà connu : il entre dans la file active du jour.
export async function checkInRoute(app: FastifyInstance) {
  app.post(
    "/api/patients/:id/arrival",
    { config: { idempotent: true }, preHandler: [authenticate, authorize("nurse", "doctor", "receptionist")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const rawOccurred = (request.body as Record<string, unknown> | undefined)?.occurredAt;
      // L'heure déclarée n'est acceptée qu'avec une clé d'envoi différé (voir idempotency.plugin.ts).
      if (rawOccurred !== undefined && !KEY_PATTERN.test(String(request.headers["idempotency-key"] ?? ""))) {
        return reply.code(400).send({ error: "occurredAt n'est accepté que pour un envoi différé." });
      }
      const occurred = parseOccurredAt(rawOccurred);
      if ("error" in occurred) return reply.code(400).send({ error: occurred.error });
      try {
        await hapiClient.get(`/Patient/${id}`);
        if (await findTodayArrival(id)) {
          return reply.code(409).send({ error: "Ce patient est déjà dans la file active du jour." });
        }
        return reply.code(201).send({ encounterId: await createArrival(id, occurred.at) });
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
