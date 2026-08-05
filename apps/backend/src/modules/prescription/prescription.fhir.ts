import type { CreatePrescriptionInput, PrescriptionSummary } from "./prescription.types.js";

// Même convention d'URI locale que ROLE_CODE_SYSTEM (socle/auth/roles.ts) et
// SERVICE_CATEGORY_SYSTEM (lib/service-category.ts) : indicateur structuré,
// lisible par machine, que le médecin a confirmé la prescription malgré une
// allergie connue (exigé par la demande : "enregistrer l'indicateur de confirmation").
export const ALLERGY_OVERRIDE_EXTENSION_URL = "http://pediatrix.local/fhir/allergy-override-confirmed";

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  authoredOn?: string;
  dosageInstruction?: { text?: string }[];
  extension?: { url: string; valueBoolean?: boolean }[];
}

export function toFhirMedicationRequest(
  patientId: string,
  encounterId: string,
  input: CreatePrescriptionInput,
  overrideAllergy: string | undefined,
) {
  return {
    resourceType: "MedicationRequest",
    status: "active",
    intent: "order",
    medicationCodeableConcept: { text: input.medication },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    authoredOn: new Date().toISOString(),
    dosageInstruction: [{ text: input.dosage }],
    note: overrideAllergy
      ? [{ text: `Prescription confirmée malgré une allergie connue à "${overrideAllergy}".` }]
      : undefined,
    extension: overrideAllergy
      ? [{ url: ALLERGY_OVERRIDE_EXTENSION_URL, valueBoolean: true }]
      : undefined,
  };
}

interface FhirBundle {
  entry?: { resource: FhirMedicationRequest }[];
}

export function fromFhirPrescriptionBundle(bundle: FhirBundle): PrescriptionSummary[] {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource);

  return resources
    .map((resource): PrescriptionSummary => ({
      id: resource.id,
      date: resource.authoredOn ?? null,
      medication: resource.medicationCodeableConcept?.text ?? null,
      dosage: resource.dosageInstruction?.[0]?.text ?? null,
      allergyOverrideConfirmed: Boolean(
        resource.extension?.some((ext) => ext.url === ALLERGY_OVERRIDE_EXTENSION_URL && ext.valueBoolean),
      ),
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
