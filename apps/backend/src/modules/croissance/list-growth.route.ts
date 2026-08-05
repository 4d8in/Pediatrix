import type { FastifyInstance } from "fastify";
import { GROWTH_CATEGORY_SEARCH_TOKEN, HEAD_CIRCUMFERENCE_LOINC } from "../../lib/growth-codes.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { VITAL_LOINC_CODES } from "../../lib/vitals-codes.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fromFhirGrowthBundle } from "./growth.fhir.js";

const GROWTH_LOINC_CODES = [VITAL_LOINC_CODES.weight.code, VITAL_LOINC_CODES.height.code, HEAD_CIRCUMFERENCE_LOINC.code];

interface FhirObservation {
  resourceType: "Observation";
  id: string;
  code?: { coding?: { code?: string }[] };
  effectiveDateTime?: string;
  valueQuantity?: { value?: number };
}

interface FhirBundle {
  entry?: { resource: FhirObservation }[];
}

export async function listGrowthRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/growth",
    { preHandler: [authenticate, authorize("doctor", "nurse")] },
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
        // category=...|growth isole les Observation créées par ce module de
        // celles créées par la Pédiatrie (Consultations) pour les mêmes codes
        // LOINC poids/taille — voir le commentaire dans lib/growth-codes.ts.
        const bundle = await hapiClient.get<FhirBundle>(
          `/Observation?patient=${id}&code=${GROWTH_LOINC_CODES.join(",")}&category=${GROWTH_CATEGORY_SEARCH_TOKEN}&_sort=-date`,
          { "Cache-Control": "no-cache" },
        );
        return reply.send({ measurements: fromFhirGrowthBundle(bundle) });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
