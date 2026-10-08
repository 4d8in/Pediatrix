import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { authenticate } from "./authenticate.js";
import { authorize } from "./authorize.js";
import { findUser, upsertUser } from "./user-store.js";

const MIN_PASSWORD_LENGTH = 8;

// Réinitialisation du mot de passe d'un compte par l'administrateur technique.
export async function resetUserPasswordRoute(app: FastifyInstance) {
  app.post<{ Params: { username: string } }>(
    "/api/users/:username/password",
    { preHandler: [authenticate, authorize("tech_admin")] },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < MIN_PASSWORD_LENGTH) {
        return reply.code(400).send({ error: `Mot de passe : ${MIN_PASSWORD_LENGTH} caractères minimum.` });
      }

      const user = await findUser(request.params.username);
      if (!user) return reply.code(404).send({ error: "Compte introuvable." });

      await upsertUser(request.params.username, { ...user, passwordHash: await bcrypt.hash(password, 10) });
      return reply.send({ ok: true });
    },
  );
}
