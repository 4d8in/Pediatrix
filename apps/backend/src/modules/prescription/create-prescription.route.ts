import type { FastifyInstance } from "fastify";
import { type FhirAllergyIntolerance, findMatchingAllergy } from "./allergy.fhir.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { checkDailyDose, hasDoseRule } from "../../lib/dose-rules.js";
import { ageInMonths } from "../../lib/nutrition.js";
import { FORMULARY, findFormularyItem } from "../../lib/formulary.js";
import { VITAL_LOINC_CODES } from "../../lib/vitals-codes.js";
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
  const doseConfirmed = b.doseConfirmed === true;

  if (!medication) errors.push("Le médicament est requis.");
  if (!dosage) errors.push("La posologie est requise.");

  const formularyCode = typeof b.formularyCode === "string" && b.formularyCode.trim() ? b.formularyCode.trim() : undefined;
  const doseMg = b.doseMg === undefined || b.doseMg === null || b.doseMg === "" ? undefined : Number(b.doseMg);
  const dosesPerDay = b.dosesPerDay === undefined || b.dosesPerDay === null || b.dosesPerDay === "" ? undefined : Number(b.dosesPerDay);
  if (formularyCode && !findFormularyItem(formularyCode)) errors.push("Article absent du formulaire.");
  if (doseMg !== undefined && (!Number.isFinite(doseMg) || doseMg <= 0 || doseMg > 10000)) errors.push("La dose (mg) est invalide.");
  if (dosesPerDay !== undefined && (!Number.isInteger(dosesPerDay) || dosesPerDay < 1 || dosesPerDay > 12)) {
    errors.push("Le nombre de prises par jour doit être un entier entre 1 et 12.");
  }
  const durationDays = b.durationDays === undefined || b.durationDays === null || b.durationDays === "" ? undefined : Number(b.durationDays);
  if (durationDays !== undefined && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90)) {
    errors.push("La durée du traitement doit être un entier de jours entre 1 et 90.");
  }
  if ((doseMg === undefined) !== (dosesPerDay === undefined)) errors.push("La dose et le nombre de prises par jour vont ensemble.");

  if (errors.length > 0) return { errors };

  return { input: { medication, dosage, confirmed, doseConfirmed, formularyCode, doseMg, dosesPerDay, durationDays } };
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
          kind: "allergy",
          message: `Le patient a une allergie connue à "${matchedAllergy.code?.text ?? "cette substance"}". Confirmez pour prescrire quand même.`,
        });
      }

      // Contrôle de la dose quotidienne par kg, si une dose structurée est fournie.
      let doseAlert: string | undefined;
      const { doseMg, dosesPerDay } = result.input;
      // Code du formulaire : fourni, ou déduit du nom du médicament saisi.
      const formularyCode =
        result.input.formularyCode ?? FORMULARY.find((item) => item.name === result.input.medication)?.code;
      if (formularyCode && hasDoseRule(formularyCode) && (doseMg === undefined || dosesPerDay === undefined)) {
        doseAlert = "Dose non vérifiée : renseignez la dose par prise et le nombre de prises par jour pour contrôler la dose par kg.";
      } else if (formularyCode && doseMg !== undefined && dosesPerDay !== undefined) {
        try {
          const weightBundle = await hapiClient.get<{ entry?: { resource: { valueQuantity?: { value?: number }; effectiveDateTime?: string; meta?: { lastUpdated?: string } } }[] }>(
            `/Observation?patient=${patientId}&code=${VITAL_LOINC_CODES.weight.code}&_sort=-date&_count=1`,
            { "Cache-Control": "no-cache" },
          );
          const weightObs = weightBundle.entry?.[0]?.resource;
          const patient = await hapiClient.get<{ birthDate?: string }>(`/Patient/${patientId}`);
          const ageMonths = patient.birthDate ? ageInMonths(patient.birthDate, new Date().toISOString()) : null;
          doseAlert = checkDailyDose(formularyCode, doseMg, dosesPerDay, weightObs?.valueQuantity?.value, {
            weightDate: weightObs?.effectiveDateTime ?? weightObs?.meta?.lastUpdated,
            ageMonths,
          })?.message;
        } catch (error) {
          if (error instanceof HapiError) {
            return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
          }
          throw error;
        }
      }
      // Une confirmation d'allergie ne vaut pas confirmation de dose : deux alertes, deux accords.
      if (doseAlert && !result.input.doseConfirmed) {
        return reply.code(409).send({ requiresConfirmation: true, kind: "dose", allergy: "", message: doseAlert });
      }

      try {
        const created = await hapiClient.post<FhirMedicationRequest>(
          "/MedicationRequest",
          toFhirMedicationRequest(patientId, id, result.input, matchedAllergy?.code?.text, {
            id: request.user.sub,
            name: request.user.name,
          }, doseAlert),
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
