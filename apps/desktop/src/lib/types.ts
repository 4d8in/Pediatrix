export type Role = "nurse" | "doctor" | "lab_tech" | "radiologist" | "director" | "tech_admin";

export interface User {
  id: string;
  role: Role;
  name: string;
}

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

export interface CreateServiceRequestInput {
  exam: string;
  requester: string;
}

export interface LabRequest {
  id: string;
  patientId: string;
  patientName: string;
  exam: string | null;
  requester: string | null;
  authoredOn: string | null;
}

export interface LabResultInput {
  label: string;
  value: string;
}

export interface CreateReportInput {
  results: LabResultInput[];
  conclusion?: string;
}

export interface Report {
  id: string;
  date: string | null;
  exam: string | null;
  conclusion: string | null;
  results: { label: string; value: string }[];
}

export interface CreateImagingRequestInput {
  exam: string;
  requester: string;
}

export interface ImagingRequest {
  id: string;
  patientId: string;
  patientName: string;
  exam: string | null;
  requester: string | null;
  authoredOn: string | null;
}

export interface CreateImagingReportInput {
  results: LabResultInput[];
  conclusion?: string;
}

export interface ImagingReport {
  id: string;
  date: string | null;
  exam: string | null;
  conclusion: string | null;
  results: { label: string; value: string }[];
}

export interface CreateImmunizationInput {
  vaccine: string;
  date: string;
  doseNumber?: number;
  notes?: string;
}

export interface Immunization {
  id: string;
  date: string | null;
  vaccine: string | null;
  doseNumber: number | null;
  notes: string | null;
}

export interface CreateGrowthInput {
  date: string;
  weight?: number;
  height?: number;
  headCircumference?: number;
}

export interface GrowthMeasurement {
  date: string;
  weight?: number;
  height?: number;
  headCircumference?: number;
}

export interface CreateAllergyInput {
  substance: string;
  reaction?: string;
}

export interface Allergy {
  id: string;
  substance: string | null;
  reaction: string | null;
  recordedDate: string | null;
}

export interface CreatePrescriptionInput {
  medication: string;
  dosage: string;
  confirmed?: boolean;
}

export interface Prescription {
  id: string;
  date: string | null;
  medication: string | null;
  dosage: string | null;
  allergyOverrideConfirmed: boolean;
}

export interface AllergyConflict {
  requiresConfirmation: true;
  allergy: string;
  message: string;
}

export interface FhirLogEntry {
  type: string;
  id: string;
  lastUpdated: string | null;
  json: unknown;
}
