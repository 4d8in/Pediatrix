export type Gender = "male" | "female" | "other" | "unknown";

export interface GuardianInput {
  name: string;
  relationship: string;
  phone: string;
}

export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  birthDate: string; // AAAA-MM-JJ
  gender: Gender;
  guardian: GuardianInput;
}

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
  guardian: GuardianInput | null;
}
