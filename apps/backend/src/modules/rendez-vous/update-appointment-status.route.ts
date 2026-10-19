import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { summarizeAppointment } from "./appointment.fhir.js";
import { APPOINTMENT_STATUSES, type AppointmentStatus, canTransition } from "./schedule.js";

// Accueil et infirmière enregistrent l'arrivée, l'annulation, l'absence ;
// le médecin clôt le rendez-vous une fois la consultation faite.
const ROLE_ALLOWED: Record<string, AppointmentStatus[]> = {
  receptionist: ["arrived", "cancelled", "noshow"],
  nurse: ["arrived", "cancelled", "noshow"],
  doctor: ["fulfilled"],
};

export async function updateAppointmentStatusRoute(app: FastifyInstance) {
  app.post(
    "/api/appointments/:id/status",
    { preHandler: [authenticate, authorize("receptionist", "nurse", "doctor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const status = (request.body as { status?: unknown } | undefined)?.status;
      if (typeof status !== "string" || !APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
        return reply.code(400).send({ error: "Statut invalide." });
      }
      const next = status as AppointmentStatus;
      if (!ROLE_ALLOWED[request.user.role]?.includes(next)) {
        return reply.code(403).send({ error: "Rôle non autorisé pour ce changement de statut." });
      }

      try {
        const appointment = await hapiClient.get<Record<string, unknown> & { status?: string }>(`/Appointment/${id}`, {
          "Cache-Control": "no-cache",
        });
        if (!canTransition((appointment.status as AppointmentStatus) ?? "booked", next)) {
          return reply.code(409).send({ error: `Un rendez-vous « ${appointment.status} » ne peut pas passer à « ${next} ».` });
        }
        const updated = await hapiClient.put<Record<string, unknown>>(`/Appointment/${id}`, { ...appointment, status: next });
        return reply.send({ appointment: summarizeAppointment(updated as never) });
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({ error: error.statusCode === 404 ? "Rendez-vous introuvable." : error.message });
        }
        throw error;
      }
    },
  );
}
