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

export interface UnavailableIndicator {
  disponible: false;
  raison: string;
}

export interface AvailableIndicator {
  disponible: true;
  valeur: string;
  detail: string;
}

export interface Stats {
  genereLe: string;
  patients: { total: number };
  consultations: { total: number; moisCourant: number };
  examens: { demandes: number; resultats: number; parType: Record<string, number> };
  vaccinations: { total: number };
  prescriptions: { total: number };
  activiteMensuelle: {
    consultations: number[];
    examensLabo: number[];
    examensImagerie: number[];
    hospitalisations: number[];
  };
  occupationParService: { service: string; total: number; occupes: number }[];
  tauxHospitalisation: UnavailableIndicator | AvailableIndicator;
  dureeMoyenneSejour: UnavailableIndicator | AvailableIndicator;
  litsOccupes: UnavailableIndicator | AvailableIndicator;
  chargeParPraticien: UnavailableIndicator;
}

export interface DashboardCounters {
  parametresVitauxAPrendre: number;
  hospitalises: UnavailableIndicator;
}

interface SevenDayCount {
  total: number;
  last7Days: number[];
}

export interface DashboardOverview {
  consultations: SevenDayCount;
  examens: SevenDayCount;
  patients: { total: number; parTrancheAge: number[] };
  vaccinations: SevenDayCount;
  activiteMensuelle: { consultations: number[]; examens: number[] };
  hospitalisation: { enCours: number; litsOccupes: number; litsTotal: number };
  laboratoire: { termines: number; enAttente: number };
  examensEnAttente: { id: string; examen: string; patient: string; demandeLe: string | null }[];
  sexes: { feminin: number; masculin: number; autre: number };
}

export interface QueueEntry {
  patientId: string;
  name: string;
  birthDate: string | null;
  gender: Gender;
  admittedAt: string | null;
  status: "en_attente" | "consulte";
  reason: string | null;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  backend: { status: "ok" };
  hapi: { status: "up" | "down"; fhirVersion: string | null };
}

export type BedStatus = "U" | "O" | "H" | "C";

export interface Bed {
  id: string;
  name: string;
  status: BedStatus;
  stay: { stayId: string; patientId: string; patientName: string; since: string | null; reason: string | null } | null;
}

export interface Ward {
  id: string;
  name: string;
  beds: Bed[];
}

export interface PatientStay {
  id: string;
  inProgress: boolean;
  start: string | null;
  end: string | null;
  reason: string | null;
  beds: { name: string; start: string | null; end: string | null }[];
}

export interface UserAccount {
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
}

export interface RecentResult {
  id: string;
  patientId: string;
  patientName: string;
  exam: string;
  kind: "laboratoire" | "imagerie";
  issued: string | null;
  conclusion: string | null;
  read: boolean;
}

export interface RequestSummary {
  enAttente: number;
  rendusAujourdhui: number;
  delaiMoyenHeures: number | null;
}

export interface UserProfile {
  displayName: string;
  phone: string | null;
  email: string | null;
  photo: { contentType: string; data: string } | null;
}
