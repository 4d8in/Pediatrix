import { LOINC_SYSTEM, findCatalogEntry } from "../../lib/lab-catalog.js";
import type { CreateServiceRequestInput } from "./service-request.types.js";

export interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
}

function examCoding(examCode: string | undefined) {
  const entry = examCode ? findCatalogEntry(examCode) : undefined;
  return entry ? [{ system: LOINC_SYSTEM, code: entry.code, display: entry.display }] : undefined;
}

export function toFhirServiceRequest(
  patientId: string,
  encounterId: string,
  input: CreateServiceRequestInput,
) {
  return {
    resourceType: "ServiceRequest",
    status: "active",
    intent: "order",
    code: {
      coding: examCoding(input.examCode),
      text: input.exam,
    },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    requester: { display: input.requester },
    authoredOn: new Date().toISOString(),
  };
}
