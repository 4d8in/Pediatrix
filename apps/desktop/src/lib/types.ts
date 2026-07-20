export type Gender = "male" | "female" | "other" | "unknown";

export interface Guardian {
  name: string;
  relationship: string;
  phone: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
  guardian: Guardian | null;
}

export interface Vitals {
  temperature?: number;
  weight?: number;
  height?: number;
  heartRate?: number;
  respiratoryRate?: number;
}

export interface Consultation {
  id: string;
  date: string | null;
  reason: string | null;
  notes: string | null;
  vitals: Vitals;
}

export interface PatientRecord {
  patient: Patient;
  consultations: Consultation[];
}

export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
  guardian: Guardian;
}

export interface CreateEncounterInput {
  reason: string;
  notes?: string;
  vitals: Vitals;
}
