import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { canReadGuardian } from "../../lib/clinical-access.js";
import { authenticate } from "../auth/authenticate.js";
import { authorize } from "../auth/authorize.js";
import { type FhirPatient, fromFhirPatient, idFromMrn } from "./patient.fhir.js";

interface FhirBundle {
  entry?: { resource: FhirPatient }[];
}

const READ_ROLES = ["nurse", "doctor", "lab_tech", "radiologist", "receptionist", "director"] as const;

export async function listPatientsRoute(app: FastifyInstance) {
  app.get("/api/patients", { preHandler: [authenticate, authorize(...READ_ROLES)] }, async (request, reply) => {
    const { search } = request.query as { search?: string };
    if (search !== undefined && typeof search !== "string") return reply.code(400).send({ error: "Paramètre de recherche invalide." });
    // Un numéro de dossier (PX-001401) retrouve directement le patient.
    const mrnId = search ? idFromMrn(search) : undefined;
    // Résultats limités explicitement (la recherche affine ; la liste complète n'a pas de sens ici).
    const query = mrnId
      ? `?_id=${mrnId}`
      : search
        ? `?name=${encodeURIComponent(search)}&_sort=-_lastUpdated&_count=50`
        : "?_sort=-_lastUpdated&_count=50";

    try {
      const bundle = await hapiClient.get<FhirBundle>(`/Patient${query}`);
      const withGuardian = canReadGuardian(request.user.role);
      const patients = (bundle.entry ?? []).map((entry) => {
        const summary = fromFhirPatient(entry.resource);
        return withGuardian ? summary : { ...summary, guardian: null };
      });
      return reply.send({ patients });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
