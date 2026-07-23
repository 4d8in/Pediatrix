import { IMAGING_CATEGORY_CODING } from "../../lib/service-category.js";
import type { CreateImagingRequestInput } from "./imaging-request.types.js";

export interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
}

export function toFhirServiceRequest(
  patientId: string,
  encounterId: string,
  input: CreateImagingRequestInput,
) {
  return {
    resourceType: "ServiceRequest",
    status: "active",
    intent: "order",
    category: [{ coding: [IMAGING_CATEGORY_CODING] }],
    code: { text: input.exam },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    requester: { display: input.requester },
    authoredOn: new Date().toISOString(),
  };
}
