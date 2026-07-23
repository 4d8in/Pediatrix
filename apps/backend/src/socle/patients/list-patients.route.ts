import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../auth/authenticate.js";
import { authorize } from "../auth/authorize.js";
import { type FhirPatient, fromFhirPatient } from "./patient.fhir.js";

interface FhirBundle {
  entry?: { resource: FhirPatient }[];
}

const READ_ROLES = ["nurse", "doctor", "lab_tech", "radiologist", "director"] as const;

export async function listPatientsRoute(app: FastifyInstance) {
  app.get("/api/patients", { preHandler: [authenticate, authorize(...READ_ROLES)] }, async (request, reply) => {
    const { search } = request.query as { search?: string };
    const query = search
      ? `?name=${encodeURIComponent(search)}&_sort=-_lastUpdated`
      : "?_sort=-_lastUpdated";

    try {
      const bundle = await hapiClient.get<FhirBundle>(`/Patient${query}`);
      const patients = (bundle.entry ?? []).map((entry) => fromFhirPatient(entry.resource));
      return reply.send({ patients });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
