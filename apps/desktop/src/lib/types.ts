export type Role =
  | "nurse"
  | "doctor"
  | "lab_tech"
  | "radiologist"
  | "pharmacist"
  | "cashier"
  | "receptionist"
  | "director"
  | "tech_admin";

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
  // Numéro de dossier (ex. PX-001401), à donner à l'accueil et aux services.
  mrn: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
  deceasedAt?: string;
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
  // Code LOINC de l'examen quand il vient du catalogue du laboratoire.
  examCode?: string;
  urgent?: boolean;
}

// Entrée du catalogue d'examens (GET /api/lab/catalog). Un panel (ex. NFS) liste ses analyses.
export interface LabTest {
  code: string;
  display: string;
  unit?: string;
  panel?: string[];
}

export interface LabRequest {
  urgent?: boolean;
  id: string;
  patientId: string;
  patientName: string;
  exam: string | null;
  examCode: string | null;
  requester: string | null;
  authoredOn: string | null;
}

export interface LabResultInput {
  label: string;
  value: string;
  // Renseignés pour une analyse du catalogue ; bornes saisies en texte (champ du formulaire).
  code?: string;
  unit?: string;
  referenceLow?: string;
  referenceHigh?: string;
  // Seuils critiques proposés par le serveur (drapeaux HH / LL à l'écran).
  criticalLow?: number;
  criticalHigh?: number;
}

export type ResultFlag = "H" | "L" | "N" | "HH" | "LL";

export interface ReferenceRange {
  low?: number;
  high?: number;
  criticalLow?: number;
  criticalHigh?: number;
}

export interface ReportResult {
  label: string;
  value: string;
  flag?: ResultFlag;
  reference?: string;
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
  results: ReportResult[];
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
  vaccineCode?: string;
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
  muac?: number;
}

export interface GrowthMeasurement {
  date: string;
  weight?: number;
  height?: number;
  headCircumference?: number;
  muac?: number;
  muacStatus?: "severe" | "moderate" | "normal";
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
  doseConfirmed?: boolean;
  formularyCode?: string;
  doseMg?: number;
  dosesPerDay?: number;
  durationDays?: number;
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
  // « allergy » ou « dose » : chaque alerte demande son propre accord.
  kind?: "allergy" | "dose";
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
  mortaliteHospitaliere: UnavailableIndicator | AvailableIndicator;
  litsOccupes: UnavailableIndicator | AvailableIndicator;
  chargeParPraticien: UnavailableIndicator | (AvailableIndicator & { parPraticien: { nom: string; consultations: number }[] });
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

export type TriageCategory = "emergency" | "priority" | "non_urgent";

export interface TriageVitals {
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  spo2?: number;
}

export interface QueueEntry {
  patientId: string;
  encounterId: string | null;
  triage: TriageCategory | null;
  vitals: TriageVitals;
  criticalVitals: (keyof TriageVitals)[];
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

export interface SurveillanceRow {
  key: string;
  label: string;
  tier: "immediate" | "weekly";
  cases: number;
  confirmed: number;
  underFive: number;
  previousAverage: number;
  alert: "immediate" | "threshold" | null;
}

export interface SurveillanceReport {
  week: string;
  from: string;
  to: string;
  rows: SurveillanceRow[];
  immediateCases: { disease: string; code: string; date: string; ageMonths: number | null; sex: string }[];
  uncoded: number;
  utcOffsetMinutes: number;
}

export type DischargeOutcome = "healed" | "improved" | "referred" | "against_advice" | "deceased";
export const DISCHARGE_OUTCOMES: { value: DischargeOutcome; label: string }[] = [
  { value: "healed", label: "Guéri" },
  { value: "improved", label: "Amélioré" },
  { value: "referred", label: "Référé vers une autre structure" },
  { value: "against_advice", label: "Sortie contre avis médical" },
  { value: "deceased", label: "Décédé" },
];

export interface PatientStay {
  id: string;
  outcome?: DischargeOutcome | null;
  summary?: string | null;
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
  critical: boolean;
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

export interface FormularyItem {
  code: string;
  name: string;
  form: string;
  unit: string;
  reorderLevel: number;
}

export interface StockLevel extends FormularyItem {
  // Quantité utilisable (hors lots périmés).
  quantity: number;
  low: boolean;
  expiredQuantity: number;
  expiringSoonQuantity: number;
}

export interface PendingPrescription {
  id: string;
  patientId: string;
  patientName: string;
  medication: string | null;
  dosage: string | null;
  authoredOn: string | null;
}

export interface ReceiptInput {
  itemCode: string;
  quantity: number;
  lot?: string;
  expiry?: string;
}

export interface TariffTable {
  currency: string;
  consultation: number;
  labDefault: number;
  labByCode: Record<string, number>;
  imagingDefault: number;
  drugs: Record<string, number>;
  customized: boolean;
}

export interface BillableEncounter {
  encounterId: string;
  patientId: string;
  patientName: string;
  reason: string | null;
  date: string | null;
  // Facture complémentaire : examens ou médicaments ajoutés après une première facture.
  supplementary?: boolean;
  unbilledCount?: number;
}

export type PaymentMethod = "cash" | "mobile_money" | "card";

export interface Invoice {
  id: string;
  encounterId: string | null;
  patientId: string;
  patientName: string;
  date: string | null;
  status: "issued" | "balanced";
  currency: string;
  total: number;
  insurer: string | null;
  coveragePercent: number;
  insurerShare: number;
  patientShare: number;
  paid: number;
  balance: number;
  lines: { description: string; amount: number }[];
  payments: { amount: number; method: string; date: string | null }[];
}

export interface BillingSummary {
  currency: string;
  invoices: number;
  collectedToday: number;
  outstanding: number;
  insurerReceivable: number;
}

export type AppointmentStatus = "booked" | "arrived" | "fulfilled" | "cancelled" | "noshow";

export interface Appointment {
  id: string;
  status: AppointmentStatus;
  start: string;
  end: string | null;
  reason: string | null;
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
}

export interface DoctorOption {
  practitionerId: string;
  name: string;
}

export interface AuditEntry {
  id: string;
  recorded: string | null;
  action: string;
  success: boolean;
  who: string;
  role: string | null;
  ip: string | null;
  patientId: string | null;
  description: string;
  login: boolean;
}

export type Certainty = "confirmed" | "provisional";

export interface DiagnosisCatalogItem {
  code: string;
  display: string;
}

export interface Diagnosis {
  id: string;
  code: string | null;
  text: string;
  certainty: Certainty;
  encounterId: string | null;
  date: string | null;
  recorder: string | null;
}

export interface Facility {
  name: string;
  address: string;
  phone: string;
}

export interface IndicatorRow {
  id: string;
  label: string;
  value: number;
  mapped: boolean;
}

export interface Dhis2Mapping {
  orgUnit: string;
  dataSet?: string;
  dataElements: Record<string, string>;
}

export interface Vaccine {
  code: string;
  name: string;
}

export type ScheduleStatus = "done" | "overdue" | "due" | "upcoming";

export interface ScheduleItem {
  vaccine: string;
  name: string;
  dose: number;
  label: string;
  dueDate: string;
  status: ScheduleStatus;
  doneDate: string | null;
}

export interface Referral {
  id: string;
  encounterId: string | null;
  date: string | null;
  destination: string;
  reason: string;
  summary: string | null;
  urgent: boolean;
  sender: string | null;
}

export type BirthAlert = "very_low_birth_weight" | "low_birth_weight" | "preterm" | "low_apgar";

export interface BirthRecord {
  birthWeightG: number;
  gestationalAgeWeeks?: number;
  apgar1?: number;
  apgar5?: number;
  deliveryMode?: "vaginal" | "caesarean" | "assisted";
  alerts: BirthAlert[];
}

export interface PmtctMilestone {
  key: string;
  label: string;
  dueDate: string;
  state: "done" | "upcoming" | "due" | "overdue";
  result: "negative" | "positive" | null;
  resultDate: string | null;
}

export interface PmtctFollowUp {
  enrolment: { motherStatus: "on_art" | "not_on_art" | "unknown"; infantProphylaxis: boolean };
  status: "in_follow_up" | "positive" | "cleared";
  milestones: PmtctMilestone[];
}

export interface DoseSchedule {
  prescriptionId: string;
  nextDueAt: string;
  state: "not_due" | "due" | "overdue" | "awaiting_pharmacy" | "finished";
}

export interface Administration {
  id: string;
  prescriptionId: string | null;
  medication: string | null;
  given: boolean;
  at: string | null;
  by: string | null;
  note: string | null;
}
