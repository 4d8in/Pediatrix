import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { isTriageCategory, toTriageObservation } from "../../lib/triage.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { parseTriageVitals, toTriageVitalObservations } from "../../lib/triage-vitals.js";
import { createArrival, findTodayArrival } from "../../lib/arrival.js";

// Tri à l'arrivée par l'infirmière : classe le patient dans la file (urgence, prioritaire, non urgent).
export async function triageRoute(app: FastifyInstance) {
  app.post(
    "/api/patients/:id/triage",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const b = (request.body ?? {}) as Record<string, unknown>;
      const note = typeof b.note === "string" && b.note.trim() ? b.note.trim() : undefined;
      if (!isTriageCategory(b.category)) {
        return reply.code(400).send({ error: "Catégorie de tri invalide (emergency, priority ou non_urgent)." });
      }

      const parsedVitals = parseTriageVitals(b.vitals);
      if ("errors" in parsedVitals) {
        return reply.code(400).send({ error: "Requête invalide.", details: parsedVitals.errors });
      }

      try {
        await hapiClient.get(`/Patient/${id}`);
        // Le tri s'attache à l'arrivée du jour ; on l'enregistre si elle n'existe pas encore.
        const encounterId = (await findTodayArrival(id))?.id ?? (await createArrival(id));
        await hapiClient.post(
          "/Observation",
          toTriageObservation(id, encounterId, b.category, note, { id: request.user.sub, name: request.user.name }),
        );
        const performer = { id: request.user.sub, name: request.user.name };
        for (const observation of toTriageVitalObservations(id, encounterId, parsedVitals.vitals, performer)) {
          await hapiClient.post("/Observation", observation);
        }
        return reply.code(201).send({ encounterId });
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
