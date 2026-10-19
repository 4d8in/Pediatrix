import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { KEY_PATTERN, idempotencyStore } from "../lib/idempotency.js";

// Voir lib/idempotency.ts. Ne s'applique qu'aux POST portant un en-tête Idempotency-Key valide,
// d'un utilisateur authentifié ; les autres requêtes ne sont pas touchées. Seules les réponses
// de succès (2xx) sont mémorisées : un échec peut être retenté avec la même clé.
export const idempotencyPlugin = fp(async function idempotencyPlugin(app: FastifyInstance) {
  app.decorateRequest("idempotency", null);

  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") return;
    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || !KEY_PATTERN.test(key)) return;
    let scope: string;
    try {
      await request.jwtVerify();
      scope = request.user.sub;
    } catch {
      return; // non authentifié : la route refusera elle-même
    }
    const stored = await idempotencyStore.get(scope, key);
    if (stored) {
      reply.header("Idempotent-Replay", "true");
      return reply.code(stored.status).type("application/json; charset=utf-8").send(stored.body);
    }
    if (!idempotencyStore.begin(scope, key)) {
      return reply.code(409).send({ error: "Cet envoi est déjà en cours de traitement." });
    }
    (request as unknown as { idempotency: { scope: string; key: string } }).idempotency = { scope, key };
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const state = (request as unknown as { idempotency: { scope: string; key: string } | null }).idempotency;
    if (!state) return payload;
    if (reply.statusCode >= 200 && reply.statusCode < 300 && typeof payload === "string") {
      await idempotencyStore.save(state.scope, state.key, reply.statusCode, payload);
    } else {
      idempotencyStore.abort(state.scope, state.key);
    }
    return payload;
  });
});
