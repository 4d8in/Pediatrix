// Référence d'un patient vers une autre structure de santé (niveau supérieur ou
// spécialisé) : lettre de référence conservée dans le dossier et imprimable.
// FHIR : ressource Communication de catégorie « referral » (une ServiceRequest
// aurait pollué les files du laboratoire et de la radiologie).
export const REFERRAL_SYSTEM = "http://pediatrix.local/fhir/communication-category";
export const REFERRAL_SEARCH_TOKEN = `${REFERRAL_SYSTEM}|referral`;

export interface CreateReferralInput {
  destination: string;
  reason: string;
  summary?: string;
  urgent: boolean;
}

export function toFhirReferral(
  patientId: string,
  encounterId: string,
  input: CreateReferralInput,
  sender: { id: string; name: string },
) {
  return {
    resourceType: "Communication",
    status: "completed",
    category: [{ coding: [{ system: REFERRAL_SYSTEM, code: "referral", display: "Référence" }] }],
    priority: input.urgent ? "urgent" : "routine",
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    sent: new Date().toISOString(),
    sender: { reference: `Practitioner/${sender.id}`, display: sender.name },
    recipient: [{ display: input.destination }],
    reasonCode: [{ text: input.reason }],
    payload: input.summary ? [{ contentString: input.summary }] : undefined,
  };
}

interface FhirCommunication {
  id?: string;
  priority?: string;
  sent?: string;
  encounter?: { reference?: string };
  sender?: { display?: string };
  recipient?: { display?: string }[];
  reasonCode?: { text?: string }[];
  payload?: { contentString?: string }[];
}

export interface ReferralSummary {
  id: string;
  encounterId: string | null;
  date: string | null;
  destination: string;
  reason: string;
  summary: string | null;
  urgent: boolean;
  sender: string | null;
}

export function summarizeReferral(communication: FhirCommunication): ReferralSummary {
  return {
    id: communication.id ?? "",
    encounterId: communication.encounter?.reference?.split("/")[1] ?? null,
    date: communication.sent ?? null,
    destination: communication.recipient?.[0]?.display ?? "",
    reason: communication.reasonCode?.[0]?.text ?? "",
    summary: communication.payload?.[0]?.contentString ?? null,
    urgent: communication.priority === "urgent",
    sender: communication.sender?.display ?? null,
  };
}
