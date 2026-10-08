import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "./authenticate.js";
import type { FhirPractitioner } from "./profile.fhir.js";
import { fromFhirPractitioner } from "./profile.fhir.js";

// Profil de l'utilisateur connecté (tous les rôles). Seul le Practitioner porté
// par le JWT est lu : impossible de consulter le profil d'un autre compte.
export async function getProfileRoute(app: FastifyInstance) {
  app.get("/api/me/profile", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const practitioner = await hapiClient.get<FhirPractitioner>(
        `/Practitioner/${encodeURIComponent(request.user.sub)}`,
      );
      return reply.send(fromFhirPractitioner(practitioner));
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
