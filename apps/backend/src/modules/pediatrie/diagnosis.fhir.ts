import { ICD10_SYSTEM, type Diagnosis } from "../../lib/diagnoses.js";

export const CERTAINTIES = ["confirmed", "provisional"] as const;
export type Certainty = (typeof CERTAINTIES)[number];

export interface CreateDiagnosisInput {
  // Code CIM-10 du catalogue, ou absent pour un diagnostic libre (texte seul).
  code?: string;
  text: string;
  certainty: Certainty;
}

export function toFhirCondition(
  patientId: string,
  encounterId: string,
  input: CreateDiagnosisInput,
  diagnosis: Diagnosis | undefined,
  recorder: { id: string; name: string },
) {
  return {
    resourceType: "Condition",
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
    verificationStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: input.certainty }],
    },
    category: [
      { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis" }] },
    ],
    code: {
      coding: diagnosis ? [{ system: ICD10_SYSTEM, code: diagnosis.code, display: diagnosis.display }] : undefined,
      text: input.text,
    },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    recordedDate: new Date().toISOString(),
    recorder: { reference: `Practitioner/${recorder.id}`, display: recorder.name },
  };
}

interface FhirCondition {
  id?: string;
  verificationStatus?: { coding?: { code?: string }[] };
  code?: { text?: string; coding?: { code?: string }[] };
  encounter?: { reference?: string };
  recordedDate?: string;
  recorder?: { display?: string };
}

export interface DiagnosisSummary {
  id: string;
  code: string | null;
  text: string;
  certainty: Certainty;
  encounterId: string | null;
  date: string | null;
  recorder: string | null;
}

export function summarizeCondition(condition: FhirCondition): DiagnosisSummary {
  return {
    id: condition.id ?? "",
    code: condition.code?.coding?.[0]?.code ?? null,
    text: condition.code?.text ?? "",
    certainty: condition.verificationStatus?.coding?.[0]?.code === "provisional" ? "provisional" : "confirmed",
    encounterId: condition.encounter?.reference?.split("/")[1] ?? null,
    date: condition.recordedDate ?? null,
    recorder: condition.recorder?.display ?? null,
  };
}
