import type {
  CreateEncounterInput,
  CreatePatientInput,
  CreateReportInput,
  CreateServiceRequestInput,
  FhirLogEntry,
  LabRequest,
  Patient,
  PatientRecord,
  Report,
} from "./types";

const BACKEND_URL = "http://localhost:3001";

// Le frontend ne parle jamais à HAPI directement : tous les appels passent
// par ce backend, qui traduit les erreurs FHIR en réponses propres.
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Le serveur Pédiatrix est injoignable.");
  }

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(body?.error ?? `Erreur ${response.status}.`, body?.details);
  }

  return body as T;
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

export function getFhirLog(): Promise<{ resources: FhirLogEntry[] }> {
  return request<{ resources: FhirLogEntry[] }>("/api/fhir-log");
}
