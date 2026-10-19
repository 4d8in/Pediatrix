import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { DISCHARGE_OUTCOME_URL, withoutDeath } from "../../lib/discharge.js";
import { isDeceased } from "../../lib/deceased.js";
import { withLock } from "../../lib/keyed-lock.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fetchAll } from "../../lib/fhir-search.js";
import { hapiErrorReply, runTransaction } from "./stay-store.js";

type Json = Record<string, unknown> & { id?: string; meta?: { versionId?: string }; extension?: { url: string; valueCode?: string }[] };

function putEntry(resourceType: string, resource: Json) {
  const request: Record<string, unknown> = { method: "PUT", url: `${resourceType}/${resource.id}` };
  if (resource.meta?.versionId) request.ifMatch = `W/"${resource.meta.versionId}"`;
  return { resource, request };
}

// Correction d'un décès enregistré par erreur : réservée au médecin, motif obligatoire, tracée dans le séjour.
export async function revokeDeathRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/patients/:id/deceased/revoke",
    { preHandler: [authenticate, authorize("doctor")] },
    async (request, reply) => {
      const reason = typeof (request.body as { reason?: unknown } | undefined)?.reason === "string" ? ((request.body as { reason: string }).reason.trim()) : "";
      if (!isSafeId(request.params.id)) return reply.code(404).send({ error: "Patient introuvable." });
      if (reason.length < 5 || reason.length > 500) {
        return reply.code(400).send({ error: "Le motif de la correction est requis (5 à 500 caractères)." });
      }
      try {
        return await withLock(`death:${request.params.id}`, async () => {
          const patient = await hapiClient.get<Json & { deceasedDateTime?: string; deceasedBoolean?: boolean }>(`/Patient/${request.params.id}`);
          if (!isDeceased(patient)) return reply.code(409).send({ error: "Ce patient n'est pas enregistré comme décédé." });

          const stays = (await fetchAll<Json>(`/Encounter?patient=${request.params.id}&class=IMP&status=finished`)).filter((stay) =>
            stay.extension?.some((e) => e.url === DISCHARGE_OUTCOME_URL && e.valueCode === "deceased"),
          );
          const note = `Décès annulé par ${request.user.name} le ${new Date().toISOString()} : ${reason}`;
          const { deceasedDateTime: _a, deceasedBoolean: _b, ...living } = patient;
          // La correction est aussi tracée sur le dossier du patient (même sans séjour concerné).
          const patientExtensions = [...((living as Json).extension ?? []), { url: "http://pediatrix.local/fhir/death-correction", valueString: note }];
          await runTransaction([
            putEntry("Patient", { ...(living as Json), extension: patientExtensions } as Json),
            ...stays.map((stay) => putEntry("Encounter", withoutDeath(stay, note) as Json)),
          ]);
          return reply.send({ ok: true, staysCorrected: stays.length });
        });
      } catch (error) {
        if (error instanceof HapiError && error.statusCode === 404) return reply.code(404).send({ error: "Patient introuvable." });
        if (error instanceof HapiError && error.statusCode === 412) {
          return reply.code(409).send({ error: "Le dossier a été modifié entre-temps : réessayez." });
        }
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
