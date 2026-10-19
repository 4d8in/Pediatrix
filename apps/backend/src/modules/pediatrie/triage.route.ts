import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { isTriageCategory, toTriageObservation } from "../../lib/triage.js";
import { KEY_PATTERN } from "../../lib/idempotency.js";
import { parseOccurredAt } from "../../lib/occurred-at.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { parseTriageVitals, toTriageVitalObservations } from "../../lib/triage-vitals.js";
import { findTodayArrival, toArrivedEncounter } from "../../lib/arrival.js";

// Tri à l'arrivée par l'infirmière : classe le patient dans la file (urgence, prioritaire, non urgent).
export async function triageRoute(app: FastifyInstance) {
  app.post(
    "/api/patients/:id/triage",
    { config: { idempotent: true }, preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const b = (request.body ?? {}) as Record<string, unknown>;
      const note = typeof b.note === "string" && b.note.trim() ? b.note.trim() : undefined;
      if (!isTriageCategory(b.category)) {
        return reply.code(400).send({ error: "Catégorie de tri invalide (emergency, priority ou non_urgent)." });
      }

      if (b.occurredAt !== undefined && !KEY_PATTERN.test(String(request.headers["idempotency-key"] ?? ""))) {
        return reply.code(400).send({ error: "occurredAt n'est accepté que pour un envoi différé." });
      }
      const occurred = parseOccurredAt(b.occurredAt);
      if ("error" in occurred) return reply.code(400).send({ error: occurred.error });
      const parsedVitals = parseTriageVitals(b.vitals);
      if ("errors" in parsedVitals) {
        return reply.code(400).send({ error: "Requête invalide.", details: parsedVitals.errors });
      }

      try {
        await hapiClient.get(`/Patient/${id}`);
        // Arrivée (si elle n'existe pas encore), tri et constantes dans UNE transaction : un renvoi
        // après un échec partiel ne peut pas laisser de moitié d'écriture ni de doublon.
        const existingId = (await findTodayArrival(id))?.id;
        const performer = { id: request.user.sub, name: request.user.name };
        const encounterRef = existingId ? `Encounter/${existingId}` : "urn:uuid:triage-encounter";
        const observations = [
          toTriageObservation(id, existingId ?? "x", b.category, note, performer, occurred.at),
          ...toTriageVitalObservations(id, existingId ?? "x", parsedVitals.vitals, performer, occurred.at),
        ].map((observation) => ({ ...observation, encounter: { reference: encounterRef } }));
        const bundle = {
          resourceType: "Bundle",
          type: "transaction",
          entry: [
            ...(existingId
              ? []
              : [{ fullUrl: encounterRef, resource: toArrivedEncounter(id, occurred.at), request: { method: "POST", url: "Encounter" } }]),
            ...observations.map((resource) => ({ resource, request: { method: "POST", url: "Observation" } })),
          ],
        };
        const response = await hapiClient.post<{ entry?: { response?: { location?: string } }[] }>("", bundle);
        const encounterId =
          existingId ??
          response.entry?.map((e) => e.response?.location).find((l) => l?.startsWith("Encounter/"))?.split("/")[1];
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
