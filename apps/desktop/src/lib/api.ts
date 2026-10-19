import type {
  Allergy,
  CreateAllergyInput,
  CreateEncounterInput,
  CreateGrowthInput,
  CreateImagingReportInput,
  CreateImagingRequestInput,
  CreateImmunizationInput,
  CreatePatientInput,
  CreatePrescriptionInput,
  CreateReportInput,
  CreateServiceRequestInput,
  DashboardCounters,
  DashboardOverview,
  DischargeOutcome,
  QueueEntry,
  SurveillanceReport,
  ReferenceRange,
  TriageVitals,
  HealthStatus,
  BedStatus,
  Ward,
  PatientStay,
  UserAccount,
  RecentResult,
  RequestSummary,
  UserProfile,
  Role,
  FhirLogEntry,
  GrowthMeasurement,
  BirthRecord,
  Administration,
  DoseSchedule,
  Stats,
  ImagingReport,
  ImagingRequest,
  Immunization,
  Appointment,
  TriageCategory,
  AuditEntry,
  AppointmentStatus,
  BillableEncounter,
  BillingSummary,
  Certainty,
  Diagnosis,
  Dhis2Mapping,
  IndicatorRow,
  DiagnosisCatalogItem,
  DoctorOption,
  Facility,
  FormularyItem,
  Invoice,
  PaymentMethod,
  TariffTable,
  LabRequest,
  PendingPrescription,
  Referral,
  ScheduleItem,
  Vaccine,
  ReceiptInput,
  StockLevel,
  LabTest,
  Patient,
  PatientRecord,
  Prescription,
  Report,
  User,
} from "./types";

import { type OutboxItem, enqueue } from "./outbox";

// Résolu au build (variable Vite) : permet de recompiler l'app pour un poste
// dont le backend tourne sur une autre machine du LAN, sans toucher au code.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

// Le frontend ne parle jamais à HAPI directement : tous les appels passent
// par ce backend, qui traduit les erreurs FHIR en réponses propres.
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: string[],
    // Corps brut de la réponse : nécessaire pour les réponses d'erreur qui
    // portent des données structurées au-delà de `error`/`details` (ex. le
    // conflit d'allergie de la Prescription, voir createPrescription ci-dessous).
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Token en mémoire uniquement (pas de localStorage) : posé par AuthContext après
// login, effacé au logout ou sur un 401.
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function hasAuthToken(): boolean {
  return authToken !== null;
}

// Déclenché sur un 401 (hors /api/auth/login) pour qu'AuthContext puisse
// déconnecter proprement l'utilisateur — un 403 (rôle insuffisant) ne
// déclenche pas cette déconnexion, ce n'est pas un problème de session.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// Écriture différable : si le serveur est injoignable, la saisie est gardée sur le poste (voir
// outbox.ts) et renvoyée au retour du réseau ; l'appelant reçoit alors `queuedResult` et l'écran
// affiche le bandeau « en attente d'envoi ». Tout autre échec (refus du serveur) est remonté tel quel.
async function postOrQueue<T>(
  path: string,
  payload: Record<string, unknown>,
  label: string,
  queuedResult: T,
  options: { stampTime?: boolean } = {},
): Promise<T> {
  const key = crypto.randomUUID();
  const typedAt = new Date().toISOString();
  // Délai maximal : un serveur qui ne répond plus est traité comme injoignable (mise en file).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await request<T>(path, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Idempotency-Key": key },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === undefined) {
      // L'heure de saisie réelle n'est jointe que si l'envoi est différé (pas d'écart d'horloge en ligne).
      const body = options.stampTime ? { ...payload, occurredAt: typedAt } : payload;
      await enqueue({ id: key, path, body, label });
      return queuedResult;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const QUEUEABLE_PATH = /^\/api\/patients\/[A-Za-z0-9._-]{1,64}\/(arrival|triage|growth|immunizations|allergies)$/;

// Renvoi d'un élément de la file (même clé d'idempotence que l'envoi d'origine). Seuls les chemins
// prévus pour le différé sont acceptés : le contenu relu du disque n'est jamais exécuté tel quel.
export async function sendQueued(item: OutboxItem): Promise<void> {
  if (!QUEUEABLE_PATH.test(item.path)) throw new ApiError("Élément de file d'attente invalide.", 400);
  await request(item.path, { method: "POST", body: JSON.stringify(item.body), headers: { "Idempotency-Key": item.id } });
}

export function classifyReplayError(error: unknown): "network" | "unauthorized" | "duplicate" | "rejected" | "retry" {
  if (!(error instanceof ApiError)) return "retry";
  if (error.status === undefined) return "network";
  if (error.status === 401) return "unauthorized";
  const code = (error.body as { code?: string } | undefined)?.code;
  // Le premier envoi est encore en cours côté serveur : on réessaiera, ce n'est pas un doublon.
  if (error.status === 409 && code === "in_progress") return "retry";
  // Déjà fait entre-temps (ex. patient déjà dans la file du jour) : rien à renvoyer.
  if (error.status === 409) return "duplicate";
  if (error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500) return "retry";
  return "rejected";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Le serveur Pédiatrix est injoignable.");
  }

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/login") {
      onUnauthorized?.();
    }
    throw new ApiError(body?.error ?? body?.message ?? `Erreur ${response.status}.`, response.status, body?.details, body);
  }

  return body as T;
}

export function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return request<{ token: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getMe(): Promise<User> {
  return request<User>("/api/auth/me");
}

export function createPatient(input: CreatePatientInput): Promise<Patient> {
  return request<Patient>("/api/patients", { method: "POST", body: JSON.stringify(input) });
}

export function listPatients(search?: string): Promise<{ patients: Patient[] }> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<{ patients: Patient[] }>(`/api/patients${query}`);
}

export function getPatient(id: string): Promise<PatientRecord> {
  return request<PatientRecord>(`/api/patients/${id}`);
}

export function createEncounter(
  patientId: string,
  input: CreateEncounterInput,
): Promise<{ encounterId: string }> {
  return request<{ encounterId: string }>(`/api/patients/${patientId}/encounters`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createServiceRequest(
  encounterId: string,
  input: CreateServiceRequestInput,
): Promise<{ serviceRequestId: string }> {
  return request<{ serviceRequestId: string }>(`/api/encounters/${encounterId}/service-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getReferenceRanges(requestId: string): Promise<{ ranges: Record<string, ReferenceRange> }> {
  return request<{ ranges: Record<string, ReferenceRange> }>(`/api/lab/requests/${requestId}/reference-ranges`);
}

export function getLabCatalog(): Promise<{ tests: LabTest[] }> {
  return request<{ tests: LabTest[] }>("/api/lab/catalog");
}

export function listLabRequests(status: "active" | "completed" = "active"): Promise<{ requests: LabRequest[] }> {
  return request<{ requests: LabRequest[] }>(`/api/lab/requests?status=${status}`);
}

export function createReport(
  requestId: string,
  input: CreateReportInput,
): Promise<{ diagnosticReportId: string }> {
  return request<{ diagnosticReportId: string }>(`/api/lab/requests/${requestId}/report`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPatientReports(patientId: string): Promise<{ reports: Report[] }> {
  return request<{ reports: Report[] }>(`/api/patients/${patientId}/reports`);
}

export function createImagingRequest(
  encounterId: string,
  input: CreateImagingRequestInput,
): Promise<{ imagingRequestId: string }> {
  return request<{ imagingRequestId: string }>(`/api/encounters/${encounterId}/imaging-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listImagingRequests(
  status: "active" | "completed" = "active",
): Promise<{ requests: ImagingRequest[] }> {
  return request<{ requests: ImagingRequest[] }>(`/api/imaging/requests?status=${status}`);
}

export function createImagingReport(
  requestId: string,
  input: CreateImagingReportInput,
): Promise<{ diagnosticReportId: string }> {
  return request<{ diagnosticReportId: string }>(`/api/imaging/requests/${requestId}/report`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPatientImagingReports(patientId: string): Promise<{ reports: ImagingReport[] }> {
  return request<{ reports: ImagingReport[] }>(`/api/patients/${patientId}/imaging-reports`);
}

export function getFhirLog(): Promise<{ resources: FhirLogEntry[] }> {
  return request<{ resources: FhirLogEntry[] }>("/api/fhir-log");
}

export function getStats(): Promise<Stats> {
  return request<Stats>("/api/stats");
}

export function getDashboardCounters(): Promise<DashboardCounters> {
  return request<DashboardCounters>("/api/dashboard/counters");
}

export function getDashboardOverview(): Promise<DashboardOverview> {
  return request<DashboardOverview>("/api/dashboard/overview");
}

export function createImmunization(
  patientId: string,
  input: CreateImmunizationInput,
): Promise<{ immunizationId: string }> {
  return postOrQueue(`/api/patients/${patientId}/immunizations`, { ...input }, "Vaccination", { immunizationId: "" });
}

export function getPatientImmunizations(patientId: string): Promise<{ immunizations: Immunization[] }> {
  return request<{ immunizations: Immunization[] }>(`/api/patients/${patientId}/immunizations`);
}

export function createGrowthMeasurement(
  patientId: string,
  input: CreateGrowthInput,
): Promise<{ observationIds: string[] }> {
  return postOrQueue(`/api/patients/${patientId}/growth`, { ...input }, "Mesure de croissance", { observationIds: [] });
}

export function getPatientGrowth(patientId: string): Promise<{ measurements: GrowthMeasurement[] }> {
  return request<{ measurements: GrowthMeasurement[] }>(`/api/patients/${patientId}/growth`);
}

export function createAllergy(patientId: string, input: CreateAllergyInput): Promise<{ allergyId: string }> {
  return postOrQueue(`/api/patients/${patientId}/allergies`, { ...input }, "Allergie", { allergyId: "" });
}

export function getPatientAllergies(patientId: string): Promise<{ allergies: Allergy[] }> {
  return request<{ allergies: Allergy[] }>(`/api/patients/${patientId}/allergies`);
}

// Peut lever une ApiError avec status 409 : error.body porte alors
// { requiresConfirmation: true, allergy, message } (voir AllergyConflict dans
// types.ts) — le formulaire de prescription doit afficher cette alerte et
// laisser le médecin renvoyer la même requête avec `confirmed: true`.
export function createPrescription(
  encounterId: string,
  input: CreatePrescriptionInput,
): Promise<{ prescriptionId: string }> {
  return request<{ prescriptionId: string }>(`/api/encounters/${encounterId}/prescriptions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPatientPrescriptions(patientId: string): Promise<{ prescriptions: Prescription[] }> {
  return request<{ prescriptions: Prescription[] }>(`/api/patients/${patientId}/prescriptions`);
}

export function getActiveQueue(): Promise<{ queue: QueueEntry[] }> {
  return request<{ queue: QueueEntry[] }>("/api/queue");
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export const BACKEND_BASE_URL = BACKEND_URL;

export function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/api/health");
}

export function listBeds(): Promise<{ wards: Ward[] }> {
  return request<{ wards: Ward[] }>("/api/beds");
}

export function hospitalise(patientId: string, bedId: string, reason: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/hospitalisations", {
    method: "POST",
    body: JSON.stringify({ patientId, bedId, reason }),
  });
}

export function transferStay(stayId: string, bedId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/hospitalisations/${stayId}/transfer`, {
    method: "POST",
    body: JSON.stringify({ bedId }),
  });
}

export function getWeeklySurveillance(week: string): Promise<SurveillanceReport> {
  return request<SurveillanceReport>(`/api/surveillance/weekly?week=${encodeURIComponent(week)}`);
}

export function dischargeStay(stayId: string, input: { outcome?: DischargeOutcome; summary?: string; deceasedAt?: string } = {}): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/hospitalisations/${stayId}/discharge`, { method: "POST", body: JSON.stringify(input) });
}

export function revokeDeath(patientId: string, reason: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/patients/${patientId}/deceased/revoke`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function getPatientBirth(patientId: string): Promise<{ birth: BirthRecord | null }> {
  return request<{ birth: BirthRecord | null }>(`/api/patients/${patientId}/birth`);
}

export function createBirth(
  patientId: string,
  input: { birthWeightG: number; gestationalAgeWeeks?: number; apgar1?: number; apgar5?: number; deliveryMode?: string },
): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/patients/${patientId}/birth`, { method: "POST", body: JSON.stringify(input) });
}

export function getStayAdministrations(stayId: string): Promise<{ administrations: Administration[]; schedule: DoseSchedule[] }> {
  return request<{ administrations: Administration[]; schedule: DoseSchedule[] }>(`/api/hospitalisations/${stayId}/administrations`);
}

export function recordAdministration(
  stayId: string,
  input: { prescriptionId: string; given: boolean; note?: string },
): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/hospitalisations/${stayId}/administrations`, { method: "POST", body: JSON.stringify(input) });
}

export function setBedStatus(bedId: string, status: Exclude<BedStatus, "O">): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/beds/${bedId}/status`, { method: "POST", body: JSON.stringify({ status }) });
}

export function getPatientStays(patientId: string): Promise<{ stays: PatientStay[] }> {
  return request<{ stays: PatientStay[] }>(`/api/patients/${patientId}/stays`);
}

export function listUserAccounts(): Promise<{ users: UserAccount[] }> {
  return request<{ users: UserAccount[] }>("/api/users");
}

export function createUserAccount(input: {
  username: string;
  displayName: string;
  role: Role;
  password: string;
}): Promise<{ username: string }> {
  return request<{ username: string }>("/api/users", { method: "POST", body: JSON.stringify(input) });
}

export function resetUserPassword(username: string, password: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/users/${encodeURIComponent(username)}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function setUserActive(username: string, active: boolean): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/users/${encodeURIComponent(username)}/active`, {
    method: "POST",
    body: JSON.stringify({ active }),
  });
}

export function getRecentResults(): Promise<{ results: RecentResult[] }> {
  return request<{ results: RecentResult[] }>("/api/results/recent");
}

export function markResultRead(reportId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/results/${reportId}/read`, { method: "POST", body: "{}" });
}

export function getLabSummary(): Promise<RequestSummary> {
  return request<RequestSummary>("/api/lab/summary");
}

export function getImagingSummary(): Promise<RequestSummary> {
  return request<RequestSummary>("/api/imaging/summary");
}

export function getMyProfile(): Promise<UserProfile> {
  return request<UserProfile>("/api/me/profile");
}

export function updateMyProfile(profile: UserProfile): Promise<UserProfile> {
  return request<UserProfile>("/api/me/profile", { method: "PUT", body: JSON.stringify(profile) });
}

export function getFormulary(): Promise<{ items: FormularyItem[] }> {
  return request<{ items: FormularyItem[] }>("/api/pharmacy/formulary");
}

export function getStock(): Promise<{ items: StockLevel[] }> {
  return request<{ items: StockLevel[] }>("/api/pharmacy/stock");
}

export function receiveStock(input: ReceiptInput): Promise<{ receiptId: string }> {
  return request<{ receiptId: string }>("/api/pharmacy/stock/receipts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listPendingPrescriptions(
  status: "active" | "completed" = "active",
): Promise<{ prescriptions: PendingPrescription[] }> {
  return request<{ prescriptions: PendingPrescription[] }>(`/api/pharmacy/prescriptions?status=${status}`);
}

export function dispensePrescription(
  prescriptionId: string,
  input: { itemCode: string; quantity: number },
): Promise<{ dispenseId: string }> {
  return request<{ dispenseId: string }>(`/api/pharmacy/prescriptions/${prescriptionId}/dispense`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getTariffs(): Promise<{ tariffs: TariffTable; items: { code: string; name: string; unit: string }[] }> {
  return request("/api/billing/tariffs");
}

export function saveTariffs(tariffs: TariffTable): Promise<{ tariffs: TariffTable }> {
  return request<{ tariffs: TariffTable }>("/api/billing/tariffs", { method: "PUT", body: JSON.stringify(tariffs) });
}

export function listBillableEncounters(): Promise<{ encounters: BillableEncounter[] }> {
  return request<{ encounters: BillableEncounter[] }>("/api/billing/encounters");
}

export function createInvoice(
  encounterId: string,
  input: { insurer?: string; coveragePercent?: number },
): Promise<{ invoice: Invoice }> {
  return request<{ invoice: Invoice }>(`/api/billing/encounters/${encounterId}/invoice`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listInvoices(): Promise<{ invoices: Invoice[] }> {
  return request<{ invoices: Invoice[] }>("/api/billing/invoices");
}

export function addPayment(invoiceId: string, input: { amount: number; method: PaymentMethod }): Promise<{ invoice: Invoice }> {
  return request<{ invoice: Invoice }>(`/api/billing/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getBillingSummary(): Promise<BillingSummary> {
  return request<BillingSummary>("/api/billing/summary");
}

export function listDoctors(): Promise<{ doctors: DoctorOption[] }> {
  return request<{ doctors: DoctorOption[] }>("/api/appointments/doctors");
}

export function listAppointmentSlots(date: string, practitionerId: string): Promise<{ slots: string[] }> {
  return request<{ slots: string[] }>(
    `/api/appointments/slots?date=${encodeURIComponent(date)}&practitionerId=${encodeURIComponent(practitionerId)}`,
  );
}

export function listAppointments(date: string, practitionerId?: string): Promise<{ appointments: Appointment[] }> {
  const doctor = practitionerId ? `&practitionerId=${encodeURIComponent(practitionerId)}` : "";
  return request<{ appointments: Appointment[] }>(`/api/appointments?date=${encodeURIComponent(date)}${doctor}`);
}

export function createAppointment(input: {
  patientId: string;
  practitionerId: string;
  start: string;
  reason: string;
}): Promise<{ appointment: Appointment }> {
  return request<{ appointment: Appointment }>("/api/appointments", { method: "POST", body: JSON.stringify(input) });
}

export function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<{ appointment: Appointment }> {
  return request<{ appointment: Appointment }>(`/api/appointments/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function listAudit(patientId?: string): Promise<{ events: AuditEntry[] }> {
  const filter = patientId ? `&patientId=${encodeURIComponent(patientId)}` : "";
  return request<{ events: AuditEntry[] }>(`/api/audit?limit=200${filter}`);
}

export function getDiagnosisCatalog(): Promise<{ diagnoses: DiagnosisCatalogItem[] }> {
  return request<{ diagnoses: DiagnosisCatalogItem[] }>("/api/diagnoses/catalog");
}

export function createDiagnosis(
  encounterId: string,
  input: { code?: string; text?: string; certainty: Certainty },
): Promise<{ diagnosisId: string }> {
  return request<{ diagnosisId: string }>(`/api/encounters/${encounterId}/diagnoses`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPatientDiagnoses(patientId: string): Promise<{ diagnoses: Diagnosis[] }> {
  return request<{ diagnoses: Diagnosis[] }>(`/api/patients/${patientId}/diagnoses`);
}

export function getFacility(): Promise<Facility> {
  return request<Facility>("/api/facility");
}

export function getIndicators(period: string): Promise<{ period: string; mappingConfigured: boolean; indicators: IndicatorRow[] }> {
  return request(`/api/reporting/indicators?period=${encodeURIComponent(period)}`);
}

export function getDhis2Export(period: string): Promise<{ dataValueSet: unknown; unmapped: string[] }> {
  return request(`/api/reporting/dhis2?period=${encodeURIComponent(period)}`);
}

export function getDhis2Mapping(): Promise<{ mapping: Dhis2Mapping | null }> {
  return request("/api/reporting/dhis2/mapping");
}

export function saveDhis2Mapping(mapping: Dhis2Mapping): Promise<{ mapping: Dhis2Mapping }> {
  return request("/api/reporting/dhis2/mapping", { method: "PUT", body: JSON.stringify(mapping) });
}

export function getVaccineCatalog(): Promise<{ vaccines: Vaccine[] }> {
  return request<{ vaccines: Vaccine[] }>("/api/vaccines/catalog");
}

export function getVaccinationSchedule(patientId: string): Promise<{ schedule: ScheduleItem[] }> {
  return request<{ schedule: ScheduleItem[] }>(`/api/patients/${patientId}/vaccination-schedule`);
}

export function checkInPatient(patientId: string): Promise<{ encounterId: string }> {
  return postOrQueue(`/api/patients/${patientId}/arrival`, {}, "Arrivée à l'accueil", { encounterId: "" }, { stampTime: true });
}

export function markLeftWithoutConsultation(patientId: string): Promise<{ encounterId: string }> {
  return request<{ encounterId: string }>(`/api/patients/${patientId}/arrival/left`, { method: "POST", body: "{}" });
}

export function setTriage(patientId: string, category: TriageCategory, note?: string, vitals?: TriageVitals): Promise<{ encounterId: string }> {
  return postOrQueue(`/api/patients/${patientId}/triage`, { category, note, vitals }, "Tri et constantes", { encounterId: "" }, { stampTime: true });
}

export function createReferral(
  encounterId: string,
  input: { destination: string; reason: string; summary?: string; urgent: boolean },
): Promise<{ referralId: string }> {
  return request<{ referralId: string }>(`/api/encounters/${encounterId}/referral`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPatientReferrals(patientId: string): Promise<{ referrals: Referral[] }> {
  return request<{ referrals: Referral[] }>(`/api/patients/${patientId}/referrals`);
}
