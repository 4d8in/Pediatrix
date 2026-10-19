import type { FastifyInstance } from "fastify";
import { PMTCT_CATEGORY_SEARCH_TOKEN, validateEnrolment } from "../../lib/pmtct.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { isDeceased } from "../../lib/deceased.js";
import { withLock } from "../../lib/keyed-lock.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { toEnrolmentBundle } from "./pmtct.fhir.js";

// Inscrit un nourrisson exposé au VIH au suivi PTME (une seule fois).
export async function enrolPmtctRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/patients/:id/ptme",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      if (!isSafeId(request.params.id)) return reply.code(404).send({ error: "Patient introuvable." });
      const result = validateEnrolment(request.body);
      if ("errors" in result) return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
      try {
        const patient = await hapiClient.get<{ birthDate?: string; deceasedDateTime?: string; deceasedBoolean?: boolean }>(`/Patient/${request.params.id}`);
        if (isDeceased(patient)) return reply.code(409).send({ error: "Ce patient est enregistré comme décédé." });
        // Suivi réservé au nourrisson : au-delà de 24 mois, le dépistage final est passé.
        const birth = Date.parse(patient.birthDate ?? "");
        if (!Number.isNaN(birth) && Date.now() - birth > 24 * 30.44 * 86_400_000) {
          return reply.code(422).send({ error: "Le suivi PTME concerne les enfants de moins de 24 mois." });
        }
        return await withLock(`pmtct:${request.params.id}`, async () => {
          const existing = await hapiClient.get<{ entry?: unknown[] }>(
            `/Observation?patient=${request.params.id}&category=${encodeURIComponent(PMTCT_CATEGORY_SEARCH_TOKEN)}&_count=1`,
            { "Cache-Control": "no-cache" },
          );
          if ((existing.entry ?? []).length > 0) return reply.code(409).send({ error: "Cet enfant est déjà inscrit au suivi PTME." });
          await hapiClient.post("", toEnrolmentBundle(request.params.id, result.input, new Date().toISOString(), request.user.name));
          return reply.code(201).send({ ok: true });
        });
      } catch (error) {
        if (error instanceof HapiError) {
          const status = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(status).send({ error: error.statusCode === 404 ? "Patient introuvable." : error.message });
        }
        throw error;
      }
    },
  );
}
