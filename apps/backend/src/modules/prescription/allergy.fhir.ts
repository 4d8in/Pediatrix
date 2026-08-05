import type { AllergySummary, CreateAllergyInput } from "./allergy.types.js";

const CLINICAL_STATUS_SYSTEM = "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical";

export interface FhirAllergyIntolerance {
  resourceType: "AllergyIntolerance";
  id: string;
  clinicalStatus?: { coding?: { code?: string }[] };
  code?: { text?: string };
  patient: { reference: string };
  recordedDate?: string;
  reaction?: { manifestation?: { text?: string }[] }[];
}

export function toFhirAllergyIntolerance(patientId: string, input: CreateAllergyInput) {
  return {
    resourceType: "AllergyIntolerance",
    clinicalStatus: { coding: [{ system: CLINICAL_STATUS_SYSTEM, code: "active" }] },
    code: { text: input.substance },
    patient: { reference: `Patient/${patientId}` },
    recordedDate: new Date().toISOString(),
    reaction: input.reaction ? [{ manifestation: [{ text: input.reaction }] }] : undefined,
  };
}

interface FhirBundle {
  entry?: { resource: FhirAllergyIntolerance }[];
}

export function fromFhirAllergyBundle(bundle: FhirBundle): AllergySummary[] {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource);

  return resources
    .map((resource): AllergySummary => ({
      id: resource.id,
      substance: resource.code?.text ?? null,
      reaction: resource.reaction?.[0]?.manifestation?.[0]?.text ?? null,
      recordedDate: resource.recordedDate ?? null,
    }))
    .sort((a, b) => (b.recordedDate ?? "").localeCompare(a.recordedDate ?? ""));
}

// Correspondance texte simple, insensible à la casse, entre le médicament
// prescrit et les substances connues : pas de mapping de réactivité croisée
// (ex. pénicilline ↔ amoxicilline), hors de portée d'un prototype.
export function findMatchingAllergy(
  allergies: FhirAllergyIntolerance[],
  medication: string,
): FhirAllergyIntolerance | undefined {
  const medicationLower = medication.toLowerCase();
  return allergies.find((allergy) => {
    const substance = allergy.code?.text?.toLowerCase();
    if (!substance) return false;
    return medicationLower.includes(substance) || substance.includes(medicationLower);
  });
}
