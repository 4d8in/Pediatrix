import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { findUserByPractitionerId } from "../../socle/auth/user-store.js";
import { readDayAppointments } from "./appointment-store.js";
import { summarizeAppointment, toFhirAppointment } from "./appointment.fhir.js";
import { daySlots, scheduleConfig } from "./schedule.js";

// Prise de rendez-vous : le créneau doit exister, être futur et libre chez ce médecin.
export async function createAppointmentRoute(app: FastifyInstance) {
  app.post(
    "/api/appointments",
    { preHandler: [authenticate, authorize("receptionist", "nurse")] },
    async (request, reply) => {
      const b = (request.body ?? {}) as Record<string, unknown>;
      const patientId = typeof b.patientId === "string" ? b.patientId.trim() : "";
      const practitionerId = typeof b.practitionerId === "string" ? b.practitionerId.trim() : "";
      const start = typeof b.start === "string" ? b.start.trim() : "";
      const reason = typeof b.reason === "string" ? b.reason.trim() : "";

      const errors: string[] = [];
      if (!patientId) errors.push("Le patient est requis.");
      if (!practitionerId) errors.push("Le médecin est requis.");
      if (!reason) errors.push("Le motif est requis.");
      if (Number.isNaN(Date.parse(start))) errors.push("Le créneau est invalide.");
      if (errors.length > 0) return reply.code(400).send({ error: "Requête invalide.", details: errors });

      const config = scheduleConfig();
      const startIso = new Date(start).toISOString();
      const date = new Date(new Date(startIso).getTime() + config.utcOffsetMinutes * 60_000).toISOString().slice(0, 10);

      if (!daySlots(date, config).includes(startIso)) {
        return reply.code(400).send({ error: "Ce créneau n'existe pas dans le planning de l'établissement." });
      }
      if (new Date(startIso).getTime() <= Date.now()) {
        return reply.code(400).send({ error: "Ce créneau est déjà passé." });
      }

      const doctor = await findUserByPractitionerId(practitionerId);
      if (!doctor || doctor.user.role !== "doctor" || doctor.user.disabled) {
        return reply.code(400).send({ error: "Médecin introuvable." });
      }

      try {
        const patient = await hapiClient.get<{ name?: { family?: string; given?: string[] }[] }>(`/Patient/${patientId}`);
        const name = patient.name?.[0];
        const patientName = name ? `${name.given?.[0] ?? ""} ${name.family ?? ""}`.trim() : "";

        const day = await readDayAppointments(date, config, practitionerId);
        const taken = day.some((a) => a.start === startIso && a.status !== "cancelled" && a.status !== "noshow");
        if (taken) return reply.code(409).send({ error: "Ce créneau vient d'être réservé." });

        const created = await hapiClient.post<Record<string, unknown>>(
          "/Appointment",
          toFhirAppointment(
            { id: patientId, name: patientName },
            { id: practitionerId, name: doctor.user.displayName },
            startIso,
            config.slotMinutes,
            reason,
          ),
        );
        return reply.code(201).send({ appointment: summarizeAppointment(created as never) });
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
