import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { findUser } from "./user-store.js";

// Hash factice comparé quand l'identifiant est inconnu, pour que le temps de
// réponse ne révèle pas l'existence d'un compte.
const DUMMY_HASH = "$2b$10$vqKxFb6QZwv8pQ6mHVADrOblwgcL6OJpgAhor/72dGe03X2qrUe4q";

function validate(body: unknown): { username: string; password: string } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (!username || !password) {
    return { errors: ["L'identifiant et le mot de passe sont requis."] };
  }
  return { username, password };
}

export async function loginRoute(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    const result = validate(request.body);
    if ("errors" in result) {
      return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
    }

    const user = await findUser(result.username);
    const passwordOk = await bcrypt.compare(result.password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordOk) {
      return reply.code(401).send({ error: "Identifiant ou mot de passe incorrect." });
    }

    if (user.disabled) {
      return reply.code(403).send({ error: "Compte désactivé. Contactez l'administrateur technique." });
    }

    const token = await reply.jwtSign({ sub: user.practitionerId, role: user.role, name: user.displayName });
    return reply.send({ token, user: { id: user.practitionerId, role: user.role, name: user.displayName } });
  });
}
