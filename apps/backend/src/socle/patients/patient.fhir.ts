import type { CreatePatientInput, Gender, PatientSummary } from "./patient.types.js";

export interface FhirPatient {
  resourceType: "Patient";
  id?: string;
  name?: { family?: string; given?: string[] }[];
  gender?: string;
  birthDate?: string;
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

  return {
    id: resource.id ?? "",
    firstName: name?.given?.[0] ?? "",
    lastName: name?.family ?? "",
    birthDate: resource.birthDate ?? "",
    gender: (resource.gender as Gender | undefined) ?? "unknown",
    guardian: contact
      ? {
          name: contact.name?.text ?? "",
          relationship: contact.relationship?.[0]?.text ?? "",
          phone: contact.telecom?.find((t) => t.system === "phone")?.value ?? "",
        }
      : null,
  };
}
