import type { FastifyReply, FastifyRequest } from "fastify";
import { findUserByPractitionerId } from "./user-store.js";

// Vérifie le jeton, puis que le compte existe encore et n'est pas désactivé :
// sans cela, un jeton déjà émis resterait valable jusqu'à son expiration (8 h)
// après la désactivation d'un compte.
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Authentification requise." });
  }

  const account = await findUserByPractitionerId(request.user.sub);
  if (!account || account.user.disabled) {
    return reply.code(401).send({ error: "Compte désactivé ou supprimé." });
  }
  // Jeton émis avant une réinitialisation du mot de passe par un administrateur : refusé.
  const issuedAt = (request.user as { iat?: number }).iat;
  if (account.user.tokensValidFrom && (issuedAt === undefined || issuedAt < Math.floor(Date.parse(account.user.tokensValidFrom) / 1000))) {
    return reply.code(401).send({ error: "Session expirée : reconnectez-vous." });
  }
}
