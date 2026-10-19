import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { KEY_PATTERN, fingerprintOf, idempotencyStore } from "../lib/idempotency.js";
import { authenticate } from "./auth/authenticate.js";

// Voir lib/idempotency.ts. Ne s'applique qu'aux routes qui le demandent explicitement
// (`config: { idempotent: true }` : saisies qui s'ajoutent à un dossier existant, jamais d'argent,
// de stock ni de prescription), aux POST portant un en-tête Idempotency-Key valide. Le compte est
// revérifié avant tout rejeu. Seules les réponses de succès (2xx) sont mémorisées.
interface IdempotencyState {
  scope: string;
  key: string;
  fingerprint: string;
}

export const idempotencyPlugin = fp(async function idempotencyPlugin(app: FastifyInstance) {
  app.decorateRequest("idempotency", null);
  const stateOf = (request: unknown) => (request as { idempotency: IdempotencyState | null }).idempotency;

  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST" || !(request.routeOptions.config as { idempotent?: boolean } | undefined)?.idempotent) return;
    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || !KEY_PATTERN.test(key)) return;

    await authenticate(request, reply);
    if (reply.sent) return reply;

    const scope = request.user.sub;
    const fingerprint = fingerprintOf(request.method, request.url, request.body);
    const stored = await idempotencyStore.get(scope, key);
    if (stored) {
      if (stored.fingerprint !== fingerprint) {
        return reply.code(422).send({ error: "Cette clé d'envoi a déjà servi pour une autre requête.", code: "key_reused" });
      }
      reply.header("Idempotent-Replay", "true");
      return reply.code(stored.status).type("application/json; charset=utf-8").send(stored.body);
    }
    if (!idempotencyStore.begin(scope, key)) {
      reply.header("Retry-After", "5");
      return reply.code(409).send({ error: "Cet envoi est déjà en cours de traitement.", code: "in_progress" });
    }
    (request as unknown as { idempotency: IdempotencyState }).idempotency = { scope, key, fingerprint };
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const state = stateOf(request);
    if (!state) return payload;
    if (reply.statusCode >= 200 && reply.statusCode < 300 && typeof payload === "string") {
      // Une panne d'écriture du fichier ne doit pas transformer un succès en erreur (HAPI a déjà écrit).
      await idempotencyStore
        .save(state.scope, state.key, reply.statusCode, payload, state.fingerprint)
        .catch((error) => request.log.error({ err: error }, "idempotency: sauvegarde impossible"));
    } else {
      idempotencyStore.abort(state.scope, state.key);
    }
    return payload;
  });
});
