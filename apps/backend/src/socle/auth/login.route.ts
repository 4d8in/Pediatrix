import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { loginThrottle } from "../../lib/login-throttle.js";
import { recordAudit } from "../audit/audit.plugin.js";
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
  // Borne la taille : évite de journaliser un mot de passe saisi dans le champ
  // identifiant et de remplir l'audit ou la mémoire avec des noms géants.
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(username) || password.length > 256) {
    return { errors: ["Identifiant ou mot de passe incorrect."] };
  }
  return { username, password };
}

export async function loginRoute(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    const result = validate(request.body);
    if ("errors" in result) {
      return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
    }

    // Limitation des essais : par adresse et identifiant, pour freiner la devinette.
    const throttleKey = `${request.ip}|${result.username.toLowerCase()}`;
    const retryAfter = loginThrottle.retryAfterSeconds(throttleKey);
    if (retryAfter > 0) {
      reply.header("Retry-After", String(retryAfter));
      return reply.code(429).send({
        error: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
      });
    }

    const user = await findUser(result.username);
    const passwordOk = await bcrypt.compare(result.password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordOk) {
      loginThrottle.recordFailure(throttleKey);
      void recordAudit(app, {
        action: "E",
        outcome: "4",
        agent: { name: result.username },
        ip: request.ip,
        description: "Connexion refusée : identifiant ou mot de passe incorrect.",
        login: true,
      });
      return reply.code(401).send({ error: "Identifiant ou mot de passe incorrect." });
    }

    if (user.disabled) {
      return reply.code(403).send({ error: "Compte désactivé. Contactez l'administrateur technique." });
    }

    loginThrottle.recordSuccess(throttleKey);
    void recordAudit(app, {
      action: "E",
      outcome: "0",
      agent: { id: user.practitionerId, name: user.displayName, role: user.role },
      ip: request.ip,
      description: "Connexion réussie.",
      login: true,
    });

    const token = await reply.jwtSign({ sub: user.practitionerId, role: user.role, name: user.displayName });
    return reply.send({ token, user: { id: user.practitionerId, role: user.role, name: user.displayName } });
  });
}
