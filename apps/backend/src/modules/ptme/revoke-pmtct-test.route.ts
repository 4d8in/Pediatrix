import type { FastifyInstance } from "fastify";
import { PMTCT_CATEGORY_SEARCH_TOKEN, isMilestone } from "../../lib/pmtct.js";
import { fetchAll } from "../../lib/fhir-search.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { withLock } from "../../lib/keyed-lock.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fromPmtctBundle } from "./pmtct.fhir.js";

// Annule un résultat de dépistage saisi par erreur : réservé au médecin, motif obligatoire.
// L'observation est conservée avec le statut « entered-in-error » (traçabilité) et le jalon redevient saisissable.
export async function revokePmtctTestRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string; milestone: string } }>(
    "/api/patients/:id/ptme/tests/:milestone/revoke",
    { preHandler: [authenticate, authorize("doctor")] },
    async (request, reply) => {
      const reason = typeof (request.body as { reason?: unknown } | undefined)?.reason === "string" ? (request.body as { reason: string }).reason.trim() : "";
      if (!isSafeId(request.params.id) || !isMilestone(request.params.milestone)) return reply.code(404).send({ error: "Résultat introuvable." });
      if (reason.length < 5 || reason.length > 500) return reply.code(400).send({ error: "Le motif de la correction est requis (5 à 500 caractères)." });
      try {
        return await withLock(`pmtct:${request.params.id}`, async () => {
          const observations = await fetchAll<never>(
            `/Observation?patient=${request.params.id}&category=${encodeURIComponent(PMTCT_CATEGORY_SEARCH_TOKEN)}`,
          );
          const { resultIds } = fromPmtctBundle({ entry: observations.map((resource) => ({ resource })) });
          const observationId = resultIds[request.params.milestone];
          if (!observationId) return reply.code(404).send({ error: "Aucun résultat enregistré pour ce jalon." });
          const observation = await hapiClient.get<Record<string, unknown> & { note?: unknown[] }>(`/Observation/${observationId}`);
          await hapiClient.put(`/Observation/${observationId}`, {
            ...observation,
            status: "entered-in-error",
            note: [...(observation.note ?? []), { text: `Annulé par ${request.user.name} le ${new Date().toISOString()} : ${reason}` }],
          });
          return reply.send({ ok: true });
        });
      } catch (error) {
        if (error instanceof HapiError) return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        throw error;
      }
    },
  );
}
