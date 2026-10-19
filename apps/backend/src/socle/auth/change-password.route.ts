import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { authenticate } from "./authenticate.js";
import { findUserByPractitionerId, upsertUser } from "./user-store.js";

const MIN_PASSWORD_LENGTH = 8;

// Changement de son propre mot de passe (écran Paramètres). Ouvert à tout
// utilisateur connecté : on ne modifie que le compte porté par le JWT.
export async function changePasswordRoute(app: FastifyInstance) {
  app.post("/api/auth/password", { preHandler: [authenticate] }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return reply.code(400).send({
        error: `Le mot de passe actuel est requis et le nouveau doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
      });
    }

    const account = await findUserByPractitionerId(request.user.sub);
    if (!account || !(await bcrypt.compare(currentPassword, account.user.passwordHash))) {
      // 400 et non 401 : côté client, un 401 déclenche la déconnexion (session expirée).
      return reply.code(400).send({ error: "Mot de passe actuel incorrect." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Les jetons émis avant ce changement (par exemple volés) cessent de valoir ; un jeton neuf est renvoyé
    // pour que la session en cours continue.
    await upsertUser(account.username, { ...account.user, passwordHash, tokensValidFrom: new Date().toISOString() });
    const token = await reply.jwtSign({ sub: account.user.practitionerId, role: account.user.role, name: account.user.displayName });
    return reply.send({ ok: true, token });
  });
}
