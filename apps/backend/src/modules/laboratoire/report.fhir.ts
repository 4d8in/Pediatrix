import { randomUUID } from "node:crypto";
import type { CreateReportInput } from "./report.types.js";

// Ressource ServiceRequest telle que renvoyée par HAPI : on ne connaît que les
// champs qu'on lit, le reste (status compris) est préservé tel quel pour le PUT.
export interface FhirServiceRequestResource {
  resourceType: "ServiceRequest";
  id: string;
  code?: { text?: string };
  subject?: { reference?: string };
  encounter?: { reference?: string };
  [key: string]: unknown;
}

// Observations de résultat + DiagnosticReport + passage du ServiceRequest à
// "completed" dans un seul Bundle transaction : même logique d'atomicité que
// pour la création d'une consultation (Encounter + Observations).
export function toReportTransactionBundle(serviceRequest: FhirServiceRequestResource, input: CreateReportInput) {
  const patientRef = serviceRequest.subject?.reference;
  const encounterRef = serviceRequest.encounter?.reference;
  const now = new Date().toISOString();

  const observationFullUrls: string[] = [];
  const entries: unknown[] = [];

  for (const result of input.results) {
    const fullUrl = `urn:uuid:${randomUUID()}`;
    observationFullUrls.push(fullUrl);

    entries.push({
      fullUrl,
      resource: {
        resourceType: "Observation",
        status: "final",
        code: { text: result.label },
        subject: patientRef ? { reference: patientRef } : undefined,
        encounter: encounterRef ? { reference: encounterRef } : undefined,
        effectiveDateTime: now,
        valueString: result.value,
      },
      request: { method: "POST", url: "Observation" },
    });
  }

  const diagnosticReportFullUrl = `urn:uuid:${randomUUID()}`;
  entries.push({
    fullUrl: diagnosticReportFullUrl,
    resource: {
      resourceType: "DiagnosticReport",
      status: "final",
      code: { text: serviceRequest.code?.text ?? "Examen de laboratoire" },
      subject: patientRef ? { reference: patientRef } : undefined,
      encounter: encounterRef ? { reference: encounterRef } : undefined,
      basedOn: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
      issued: now,
      result: observationFullUrls.map((fullUrl) => ({ reference: fullUrl })),
      conclusion: input.conclusion,
    },
    request: { method: "POST", url: "DiagnosticReport" },
  });

  entries.push({
    resource: { ...serviceRequest, status: "completed" },
    request: { method: "PUT", url: `ServiceRequest/${serviceRequest.id}` },
  });

  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };
}

interface TransactionResponseBundle {
  entry?: { response?: { location?: string } }[];
}

export function parseReportTransactionResponse(bundle: TransactionResponseBundle): { diagnosticReportId: string } {
  const location = bundle.entry
    ?.map((entry) => entry.response?.location)
    .find((loc): loc is string => Boolean(loc?.startsWith("DiagnosticReport/")));

  const diagnosticReportId = location?.split("/")[1];
  if (!diagnosticReportId) {
    throw new Error("Réponse HAPI inattendue : identifiant du rapport introuvable.");
  }

  return { diagnosticReportId };
}
