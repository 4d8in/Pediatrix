import type { FastifyInstance } from "fastify";
import { HapiError } from "../../lib/hapi-client.js";
import { authenticate } from "./authenticate.js";
import { authorize } from "./authorize.js";
import { upsertPractitioner } from "./practitioner.fhir.js";
import { findUser, upsertUser } from "./user-store.js";

// Activer / désactiver un compte. Un compte désactivé ne peut plus se connecter
// (les sessions déjà ouvertes restent valides jusqu'à l'expiration du jeton).
// Le Practitioner FHIR suit le même état (champ `active`).
export async function setUserActiveRoute(app: FastifyInstance) {
  app.post<{ Params: { username: string } }>(
    "/api/users/:username/active",
    { preHandler: [authenticate, authorize("tech_admin")] },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (typeof body.active !== "boolean") {
        return reply.code(400).send({ error: "Le champ « active » (booléen) est requis." });
      }

      const { username } = request.params;
      const user = await findUser(username);
      if (!user) return reply.code(404).send({ error: "Compte introuvable." });
      if (!body.active && user.practitionerId === request.user.sub) {
        return reply.code(400).send({ error: "Vous ne pouvez pas désactiver votre propre compte." });
      }

      try {
        await upsertPractitioner({ username, displayName: user.displayName, role: user.role }, body.active);
        await upsertUser(username, { ...user, disabled: !body.active });
        return reply.send({ ok: true });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
