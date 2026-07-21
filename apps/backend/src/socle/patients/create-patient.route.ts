import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../auth/authenticate.js";
import { authorize } from "../auth/authorize.js";
import { type FhirPatient, fromFhirPatient, toFhirPatient } from "./patient.fhir.js";
import type { CreatePatientInput, Gender } from "./patient.types.js";

const GENDERS: Gender[] = ["male", "female", "other", "unknown"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(body: unknown): { input: CreatePatientInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const guardian = (b.guardian ?? {}) as Record<string, unknown>;

  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  const birthDate = typeof b.birthDate === "string" ? b.birthDate : "";
  const gender = b.gender;
  const guardianName = typeof guardian.name === "string" ? guardian.name.trim() : "";
  const guardianRelationship = typeof guardian.relationship === "string" ? guardian.relationship.trim() : "";
  const guardianPhone = typeof guardian.phone === "string" ? guardian.phone.trim() : "";

  if (!firstName) errors.push("Le prénom est requis.");
  if (!lastName) errors.push("Le nom est requis.");

  if (!DATE_RE.test(birthDate) || Number.isNaN(Date.parse(birthDate))) {
    errors.push("La date de naissance doit être au format AAAA-MM-JJ.");
  } else if (Date.parse(birthDate) > Date.now()) {
    errors.push("La date de naissance ne peut pas être dans le futur.");
  }

  if (!GENDERS.includes(gender as Gender)) {
    errors.push(`Le sexe doit être l'un de : ${GENDERS.join(", ")}.`);
  }

  if (!guardianName) errors.push("Le nom du tuteur est requis.");
  if (!guardianRelationship) errors.push("Le lien de parenté du tuteur est requis.");
  if (!guardianPhone) errors.push("Le téléphone du tuteur est requis.");

  if (errors.length > 0) return { errors };

  return {
    input: {
      firstName,
      lastName,
      birthDate,
      gender: gender as Gender,
      guardian: { name: guardianName, relationship: guardianRelationship, phone: guardianPhone },
    },
  };
}

export async function createPatientRoute(app: FastifyInstance) {
  app.post("/api/patients", { preHandler: [authenticate, authorize("nurse", "doctor")] }, async (request, reply) => {
    const result = validate(request.body);
    if ("errors" in result) {
      return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
    }

    try {
      const created = await hapiClient.post<FhirPatient>("/Patient", toFhirPatient(result.input));
      return reply.code(201).send(fromFhirPatient(created));
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
