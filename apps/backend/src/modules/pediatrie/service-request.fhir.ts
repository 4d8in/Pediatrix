import type { CreateServiceRequestInput } from "./service-request.types.js";

export interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
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
    code: { text: input.exam },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    requester: { display: input.requester },
    authoredOn: new Date().toISOString(),
  };
}
