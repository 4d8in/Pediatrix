import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "./authenticate.js";
import type { FhirPractitioner } from "./profile.fhir.js";
import { fromFhirPractitioner, validateProfile, withProfile } from "./profile.fhir.js";
import { findUserByPractitionerId, upsertUser } from "./user-store.js";

// Mise à jour de son propre profil (nom affiché, téléphone, e-mail, photo).
// L'identifiant et le rôle ne sont pas modifiables ici (réservés à l'admin technique).
export async function updateProfileRoute(app: FastifyInstance) {
  app.put("/api/me/profile", { preHandler: [authenticate] }, async (request, reply) => {
    const result = validateProfile(request.body);
    if ("errors" in result) {
      return reply.code(400).send({ error: "Profil invalide.", details: result.errors });
    }

    try {
      const id = encodeURIComponent(request.user.sub);
      const practitioner = await hapiClient.get<FhirPractitioner>(`/Practitioner/${id}`);
      const updated = await hapiClient.put<FhirPractitioner>(`/Practitioner/${id}`, withProfile(practitioner, result.profile));

      // Le nom affiché sert aussi au login (JWT) : on le garde synchronisé dans users.json.
      const account = await findUserByPractitionerId(request.user.sub);
      if (account) await upsertUser(account.username, { ...account.user, displayName: result.profile.displayName });

      return reply.send(fromFhirPractitioner(updated));
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
