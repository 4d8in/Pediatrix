import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { HapiError } from "../../lib/hapi-client.js";
import { authenticate } from "./authenticate.js";
import { authorize } from "./authorize.js";
import { upsertPractitioner } from "./practitioner.fhir.js";
import { isRole } from "./roles.js";
import { findUser, upsertUser } from "./user-store.js";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

// Création d'un compte : Practitioner + PractitionerRole dans HAPI (identité et
// rôle, socle FHIR) et hash du mot de passe dans users.json (jamais dans HAPI).
export async function createUserRoute(app: FastifyInstance) {
  app.post("/api/users", { preHandler: [authenticate, authorize("tech_admin")] }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role;

    const errors: string[] = [];
    if (!USERNAME_PATTERN.test(username)) errors.push("Identifiant : 3 à 32 caractères (minuscules, chiffres, . _ -).");
    if (!displayName) errors.push("Le nom affiché est requis.");
    if (!isRole(role)) errors.push("Rôle invalide.");
    if (password.length < MIN_PASSWORD_LENGTH) errors.push(`Mot de passe : ${MIN_PASSWORD_LENGTH} caractères minimum.`);
    if (errors.length > 0 || !isRole(role)) {
      return reply.code(400).send({ error: errors.join(" ") });
    }

    if (await findUser(username)) {
      return reply.code(409).send({ error: "Cet identifiant existe déjà." });
    }

    try {
      const practitionerId = await upsertPractitioner({ username, displayName, role });
      await upsertUser(username, {
        passwordHash: await bcrypt.hash(password, 10),
        practitionerId,
        role,
        displayName,
      });
      return reply.code(201).send({ username });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
