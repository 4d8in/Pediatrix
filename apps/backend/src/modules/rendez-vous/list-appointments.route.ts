import type { FastifyInstance } from "fastify";
import { HapiError } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { readDayAppointments } from "./appointment-store.js";
import { isValidDate, scheduleConfig } from "./schedule.js";

// Agenda d'une journée. Un médecin ne voit que ses propres rendez-vous.
export async function listAppointmentsRoute(app: FastifyInstance) {
  app.get(
    "/api/appointments",
    { preHandler: [authenticate, authorize("receptionist", "nurse", "doctor", "director")] },
    async (request, reply) => {
      const config = scheduleConfig();
      const query = request.query as { date?: string; practitionerId?: string };
      const date = query.date ?? new Date(Date.now() + config.utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
      if (!isValidDate(date)) return reply.code(400).send({ error: "Date invalide (AAAA-MM-JJ)." });

      const practitionerId = request.user.role === "doctor" ? request.user.sub : query.practitionerId;
      try {
        return reply.send({ date, appointments: await readDayAppointments(date, config, practitionerId) });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
