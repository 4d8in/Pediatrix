import type { FastifyInstance } from "fastify";
import { type FhirAllergyIntolerance, findMatchingAllergy } from "./allergy.fhir.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { type FhirMedicationRequest, toFhirMedicationRequest } from "./prescription.fhir.js";
import type { CreatePrescriptionInput } from "./prescription.types.js";

interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  subject?: { reference?: string };
}

interface FhirAllergyBundle {
  entry?: { resource: FhirAllergyIntolerance }[];
}

function validate(body: unknown): { input: CreatePrescriptionInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const medication = typeof b.medication === "string" ? b.medication.trim() : "";
  const dosage = typeof b.dosage === "string" ? b.dosage.trim() : "";
  const confirmed = b.confirmed === true;

  if (!medication) errors.push("Le médicament est requis.");
  if (!dosage) errors.push("La posologie est requise.");

  if (errors.length > 0) return { errors };

  return { input: { medication, dosage, confirmed } };
}

export async function createPrescriptionRoute(app: FastifyInstance) {
  app.post(
    "/api/encounters/:id/prescriptions",
    { preHandler: [authenticate, authorize("doctor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      let patientId: string | undefined;
      try {
        const encounter = await hapiClient.get<FhirEncounter>(`/Encounter/${id}`);
        patientId = encounter.subject?.reference?.split("/")[1];
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          const message = error.statusCode === 404 ? "Consultation introuvable." : error.message;
          return reply.code(statusCode).send({ error: message });
        }
        throw error;
      }

      if (!patientId) {
        return reply.code(502).send({ error: "Consultation sans patient associé." });
      }

      const result = validate(request.body);
      if ("errors" in result) {
        return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
      }

      let matchedAllergy: FhirAllergyIntolerance | undefined;
      try {
        const allergyBundle = await hapiClient.get<FhirAllergyBundle>(
          `/AllergyIntolerance?patient=${patientId}&clinical-status=active`,
          { "Cache-Control": "no-cache" },
        );
        const allergies = (allergyBundle.entry ?? []).map((entry) => entry.resource);
        matchedAllergy = findMatchingAllergy(allergies, result.input.medication);
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }

      if (matchedAllergy && !result.input.confirmed) {
        return reply.code(409).send({
          requiresConfirmation: true,
          allergy: matchedAllergy.code?.text ?? "allergie connue",
          message: `Le patient a une allergie connue à "${matchedAllergy.code?.text ?? "cette substance"}". Confirmez pour prescrire quand même.`,
        });
      }

      try {
        const created = await hapiClient.post<FhirMedicationRequest>(
          "/MedicationRequest",
          toFhirMedicationRequest(patientId, id, result.input, matchedAllergy?.code?.text),
        );
        return reply.code(201).send({ prescriptionId: created.id });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
