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
  FhirLogEntry,
  GrowthMeasurement,
  Stats,
  ImagingReport,
  ImagingRequest,
  Immunization,
  LabRequest,
  Patient,
  PatientRecord,
  Prescription,
  Report,
  User,
} from "./types";

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

export function listLabRequests(): Promise<{ requests: LabRequest[] }> {
  return request<{ requests: LabRequest[] }>("/api/lab/requests");
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

export function listImagingRequests(): Promise<{ requests: ImagingRequest[] }> {
  return request<{ requests: ImagingRequest[] }>("/api/imaging/requests");
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

export function createImmunization(
  patientId: string,
  input: CreateImmunizationInput,
): Promise<{ immunizationId: string }> {
  return request<{ immunizationId: string }>(`/api/patients/${patientId}/immunizations`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPatientImmunizations(patientId: string): Promise<{ immunizations: Immunization[] }> {
  return request<{ immunizations: Immunization[] }>(`/api/patients/${patientId}/immunizations`);
}

export function createGrowthMeasurement(
  patientId: string,
  input: CreateGrowthInput,
): Promise<{ observationIds: string[] }> {
  return request<{ observationIds: string[] }>(`/api/patients/${patientId}/growth`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPatientGrowth(patientId: string): Promise<{ measurements: GrowthMeasurement[] }> {
  return request<{ measurements: GrowthMeasurement[] }>(`/api/patients/${patientId}/growth`);
}

export function createAllergy(patientId: string, input: CreateAllergyInput): Promise<{ allergyId: string }> {
  return request<{ allergyId: string }>(`/api/patients/${patientId}/allergies`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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
