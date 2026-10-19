import type { CreatePatientInput, Gender, PatientSummary } from "./patient.types.js";

// Numéro de dossier = identifiant HAPI du patient, complété à 6 chiffres : unique,
// sans compteur à synchroniser, et recalculable pour les dossiers créés avant
// l'introduction du numéro (jamais de migration de données).
export const MRN_SYSTEM = "http://pediatrix.local/fhir/mrn";
const MRN_PREFIX = "PX-";

export function mrnFromId(id: string): string {
  return `${MRN_PREFIX}${id.padStart(6, "0")}`;
}

// Retrouve l'identifiant HAPI d'un numéro saisi ("PX-001401", "px1401"), sinon undefined.
export function idFromMrn(text: string): string | undefined {
  const match = /^PX-?(\d{1,12})$/i.exec(text.trim());
  return match ? String(Number(match[1])) : undefined;
}

export interface FhirPatient {
  resourceType: "Patient";
  id?: string;
  identifier?: { system?: string; value?: string }[];
  name?: { family?: string; given?: string[] }[];
  gender?: string;
  birthDate?: string;
  deceasedDateTime?: string;
  contact?: {
    relationship?: { text?: string }[];
    name?: { text?: string };
    telecom?: { system?: string; value?: string }[];
  }[];
}

export function toFhirPatient(input: CreatePatientInput): FhirPatient {
  return {
    resourceType: "Patient",
    name: [{ family: input.lastName, given: [input.firstName] }],
    gender: input.gender,
    birthDate: input.birthDate,
    contact: [
      {
        relationship: [{ text: input.guardian.relationship }],
        name: { text: input.guardian.name },
        telecom: [{ system: "phone", value: input.guardian.phone }],
      },
    ],
  };
}

export function fromFhirPatient(resource: FhirPatient): PatientSummary {
  const name = resource.name?.[0];
  const contact = resource.contact?.[0];

  const id = resource.id ?? "";
  return {
    id,
    mrn: resource.identifier?.find((i) => i.system === MRN_SYSTEM)?.value ?? (id ? mrnFromId(id) : ""),
    firstName: name?.given?.[0] ?? "",
    lastName: name?.family ?? "",
    birthDate: resource.birthDate ?? "",
    gender: (resource.gender as Gender | undefined) ?? "unknown",
    ...(resource.deceasedDateTime ? { deceasedAt: resource.deceasedDateTime } : {}),
    guardian: contact
      ? {
          name: contact.name?.text ?? "",
          relationship: contact.relationship?.[0]?.text ?? "",
          phone: contact.telecom?.find((t) => t.system === "phone")?.value ?? "",
        }
      : null,
  };
}
