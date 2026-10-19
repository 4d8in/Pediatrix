import type { FastifyInstance } from "fastify";
import { HapiError } from "../../lib/hapi-client.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { readDayAppointments } from "./appointment-store.js";
import { freeSlots, isValidDate, scheduleConfig } from "./schedule.js";

// Créneaux libres d'un médecin pour une journée.
export async function listSlotsRoute(app: FastifyInstance) {
  app.get(
    "/api/appointments/slots",
    { preHandler: [authenticate, authorize("receptionist", "nurse", "doctor")] },
    async (request, reply) => {
      const { date, practitionerId } = request.query as { date?: string; practitionerId?: string };
      if (!date || !isValidDate(date) || !isSafeId(practitionerId)) {
        return reply.code(400).send({ error: "Paramètres date (AAAA-MM-JJ) et practitionerId requis." });
      }
      const config = scheduleConfig();
      try {
        const day = await readDayAppointments(date, config, practitionerId);
        const booked = day.filter((a) => a.status !== "cancelled" && a.status !== "noshow").map((a) => a.start);
        return reply.send({ slots: freeSlots(date, booked, config), slotMinutes: config.slotMinutes });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
