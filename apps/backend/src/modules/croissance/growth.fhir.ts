import { randomUUID } from "node:crypto";
import { GROWTH_CATEGORY_CODING, HEAD_CIRCUMFERENCE_LOINC } from "../../lib/growth-codes.js";
import { VITAL_LOINC_CODES } from "../../lib/vitals-codes.js";
import type { CreateGrowthInput, GrowthMeasurement } from "./growth.types.js";

const MEASURE_CODES = {
  weight: VITAL_LOINC_CODES.weight,
  height: VITAL_LOINC_CODES.height,
  headCircumference: HEAD_CIRCUMFERENCE_LOINC,
} as const;

type MeasureKey = keyof typeof MEASURE_CODES;

// Une Observation par mesure fournie, regroupées dans une transaction FHIR
// (mêmes garanties d'atomicité que toEncounterTransactionBundle) : soit toutes
// les mesures de cette saisie sont créées, soit aucune.
export function toGrowthTransactionBundle(patientId: string, input: CreateGrowthInput) {
  const patientRef = `Patient/${patientId}`;
  const entries: unknown[] = [];

  for (const key of Object.keys(MEASURE_CODES) as MeasureKey[]) {
    const value = input[key];
    if (value === undefined) continue;
    const meta = MEASURE_CODES[key];

    entries.push({
      fullUrl: `urn:uuid:${randomUUID()}`,
      resource: {
        resourceType: "Observation",
        status: "final",
        category: [{ coding: [GROWTH_CATEGORY_CODING] }],
        code: { coding: [{ system: "http://loinc.org", code: meta.code, display: meta.display }] },
        subject: { reference: patientRef },
        effectiveDateTime: input.date,
        valueQuantity: { value, unit: meta.unit, system: "http://unitsofmeasure.org", code: meta.unit },
      },
      request: { method: "POST", url: "Observation" },
    });
  }

  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };
}

interface TransactionResponseBundle {
  entry?: { response?: { location?: string } }[];
}

export function parseGrowthTransactionResponse(bundle: TransactionResponseBundle): { observationIds: string[] } {
  const observationIds = (bundle.entry ?? [])
    .map((entry) => entry.response?.location)
    .filter((loc): loc is string => Boolean(loc?.startsWith("Observation/")))
    .map((loc) => loc.split("/")[1]);

  return { observationIds };
}

interface FhirObservation {
  resourceType: "Observation";
  id: string;
  code?: { coding?: { code?: string }[] };
  effectiveDateTime?: string;
  valueQuantity?: { value?: number };
}

interface FhirBundle {
  entry?: { resource: FhirObservation }[];
}

const LOINC_TO_MEASURE_KEY: Record<string, MeasureKey> = Object.fromEntries(
  (Object.entries(MEASURE_CODES) as [MeasureKey, { code: string }][]).map(([key, meta]) => [meta.code, key]),
);

export function fromFhirGrowthBundle(bundle: FhirBundle): GrowthMeasurement[] {
  const observations = (bundle.entry ?? []).map((entry) => entry.resource);
  const byDate = new Map<string, GrowthMeasurement>();

  for (const obs of observations) {
    const date = obs.effectiveDateTime;
    const loincCode = obs.code?.coding?.[0]?.code;
    const measureKey = loincCode ? LOINC_TO_MEASURE_KEY[loincCode] : undefined;
    const value = obs.valueQuantity?.value;
    if (!date || !measureKey || value === undefined) continue;

    const entry = byDate.get(date) ?? { date };
    entry[measureKey] = value;
    byDate.set(date, entry);
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
