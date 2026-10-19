import { VACCINE_SYSTEM, findVaccine } from "../../lib/vaccines.js";
import type { CreateImmunizationInput, ImmunizationSummary } from "./immunization.types.js";

export interface FhirImmunization {
  resourceType: "Immunization";
  id: string;
  status: "completed";
  vaccineCode: { text: string; coding?: { system?: string; code?: string }[] };
  patient: { reference: string };
  occurrenceDateTime: string;
  protocolApplied?: { doseNumberPositiveInt: number }[];
  note?: { text: string }[];
}

function vaccineCoding(code: string | undefined) {
  const vaccine = code ? findVaccine(code) : undefined;
  return vaccine ? [{ system: VACCINE_SYSTEM, code: vaccine.code, display: vaccine.name }] : undefined;
}

export function toFhirImmunization(patientId: string, input: CreateImmunizationInput) {
  return {
    resourceType: "Immunization",
    status: "completed",
    vaccineCode: {
      coding: vaccineCoding(input.vaccineCode),
      text: input.vaccine,
    },
    patient: { reference: `Patient/${patientId}` },
    occurrenceDateTime: input.date,
    protocolApplied:
      input.doseNumber !== undefined ? [{ doseNumberPositiveInt: input.doseNumber }] : undefined,
    note: input.notes ? [{ text: input.notes }] : undefined,
  };
}

interface FhirBundle {
  entry?: { resource: FhirImmunization }[];
}

export function fromFhirImmunizationBundle(bundle: FhirBundle): ImmunizationSummary[] {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource);

  return resources
    .map((resource): ImmunizationSummary => ({
      id: resource.id,
      date: resource.occurrenceDateTime ?? null,
      vaccine: resource.vaccineCode?.text ?? null,
      vaccineCode: resource.vaccineCode?.coding?.find((c) => c.system === VACCINE_SYSTEM)?.code ?? null,
      doseNumber: resource.protocolApplied?.[0]?.doseNumberPositiveInt ?? null,
      notes: resource.note?.[0]?.text ?? null,
    }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
