import { randomUUID } from "node:crypto";
import { LOINC_SYSTEM, UCUM_SYSTEM, findCatalogEntry } from "../../lib/lab-catalog.js";
import type { CreateReportInput, LabResultInput } from "./report.types.js";

export type ResultFlag = "H" | "L" | "N";

const INTERPRETATION_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";
const FLAG_DISPLAY: Record<ResultFlag, string> = { H: "Élevé", L: "Bas", N: "Normal" };

// Lit une valeur saisie comme un nombre ("8.2", "8,2"). Une valeur avec son unité
// collée ("8.2 g/dL") ou un résultat qualitatif ("Positif") n'est pas numérique.
export function parseNumericValue(raw: string): number | undefined {
  const text = raw.trim().replace(",", ".");
  return /^-?(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : undefined;
}

// Sans borne de référence, on ne juge pas : pas de drapeau plutôt qu'un faux "normal".
export function interpretValue(value: number, low?: number, high?: number): ResultFlag | undefined {
  if (low === undefined && high === undefined) return undefined;
  if (low !== undefined && value < low) return "L";
  if (high !== undefined && value > high) return "H";
  return "N";
}

interface Quantity {
  value: number;
  unit?: string;
  system?: string;
  code?: string;
}

// Observation de résultat telle qu'envoyée à HAPI.
export interface ResultObservation {
  resourceType: "Observation";
  status: "final";
  code: { coding?: { system: string; code: string; display: string }[]; text: string };
  subject?: { reference: string };
  encounter?: { reference: string };
  effectiveDateTime: string;
  valueQuantity?: Quantity;
  valueString?: string;
  referenceRange?: { low?: Quantity; high?: Quantity }[];
  interpretation?: { coding: { system: string; code: ResultFlag; display: string }[] }[];
}

function toQuantity(value: number, unit?: string): Quantity {
  return unit ? { value, unit, system: UCUM_SYSTEM, code: unit } : { value };
}

// Une analyse numérique devient une Observation à valeur quantifiée (valueQuantity),
// avec plage de référence et interprétation ; sinon on garde le texte tel quel
// (valueString), comme avant, pour ne rien casser des résultats qualitatifs.
export function toResultObservation(
  result: LabResultInput,
  patientRef: string | undefined,
  encounterRef: string | undefined,
  now: string,
): ResultObservation {
  const entry = result.code ? findCatalogEntry(result.code) : undefined;
  const numeric = parseNumericValue(result.value);
  const unit = result.unit ?? entry?.unit;
  const flag = numeric === undefined ? undefined : interpretValue(numeric, result.referenceLow, result.referenceHigh);
  const hasRange = result.referenceLow !== undefined || result.referenceHigh !== undefined;

  return {
    resourceType: "Observation",
    status: "final",
    code: {
      coding: entry ? [{ system: LOINC_SYSTEM, code: entry.code, display: entry.display }] : undefined,
      text: result.label,
    },
    subject: patientRef ? { reference: patientRef } : undefined,
    encounter: encounterRef ? { reference: encounterRef } : undefined,
    effectiveDateTime: now,
    ...(numeric === undefined ? { valueString: result.value } : { valueQuantity: toQuantity(numeric, unit) }),
    referenceRange: hasRange
      ? [
          {
            low: result.referenceLow === undefined ? undefined : toQuantity(result.referenceLow, unit),
            high: result.referenceHigh === undefined ? undefined : toQuantity(result.referenceHigh, unit),
          },
        ]
      : undefined,
    interpretation: flag
      ? [{ coding: [{ system: INTERPRETATION_SYSTEM, code: flag, display: FLAG_DISPLAY[flag] }] }]
      : undefined,
  };
}

// Ressource ServiceRequest telle que renvoyée par HAPI : on ne connaît que les
// champs qu'on lit, le reste (status compris) est préservé tel quel pour le PUT.
export interface FhirServiceRequestResource {
  resourceType: "ServiceRequest";
  id: string;
  code?: { text?: string; coding?: unknown[] };
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
      resource: toResultObservation(result, patientRef, encounterRef, now),
      request: { method: "POST", url: "Observation" },
    });
  }

  const diagnosticReportFullUrl = `urn:uuid:${randomUUID()}`;
  entries.push({
    fullUrl: diagnosticReportFullUrl,
    resource: {
      resourceType: "DiagnosticReport",
      status: "final",
      code: serviceRequest.code?.coding ? serviceRequest.code : { text: serviceRequest.code?.text ?? "Examen de laboratoire" },
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
