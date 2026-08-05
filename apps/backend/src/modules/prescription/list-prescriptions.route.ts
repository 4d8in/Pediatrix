import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { type FhirMedicationRequest, fromFhirPrescriptionBundle } from "./prescription.fhir.js";

const READ_ROLES = ["nurse", "doctor", "lab_tech", "director"] as const;

interface FhirBundle {
  entry?: { resource: FhirMedicationRequest }[];
}

export async function listPrescriptionsRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/prescriptions",
    { preHandler: [authenticate, authorize(...READ_ROLES)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await hapiClient.get(`/Patient/${id}`);
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          const message = error.statusCode === 404 ? "Patient introuvable." : error.message;
          return reply.code(statusCode).send({ error: message });
        }
        throw error;
      }

      try {
        const bundle = await hapiClient.get<FhirBundle>(
          `/MedicationRequest?patient=${id}&_sort=-authoredon`,
          { "Cache-Control": "no-cache" },
        );
        return reply.send({ prescriptions: fromFhirPrescriptionBundle(bundle) });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
