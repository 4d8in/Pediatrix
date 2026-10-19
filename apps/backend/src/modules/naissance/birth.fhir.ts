import { randomUUID } from "node:crypto";
import {
  BIRTH_CATEGORY_CODE,
  BIRTH_CATEGORY_SYSTEM,
  BIRTH_CODES,
  DELIVERY_CODE,
  DELIVERY_MODES,
  birthAlerts,
  type BirthInput,
  type BirthRecord,
  type DeliveryMode,
} from "../../lib/birth.js";

const CATEGORY = [{ coding: [{ system: BIRTH_CATEGORY_SYSTEM, code: BIRTH_CATEGORY_CODE, display: "Registre de naissance" }] }];

// Une Observation par donnée, dans une transaction : tout le registre est créé ou rien.
export function toBirthBundle(patientId: string, input: BirthInput, effective: string) {
  const entries: unknown[] = [];
  const base = { resourceType: "Observation", status: "final", category: CATEGORY, subject: { reference: `Patient/${patientId}` }, effectiveDateTime: effective };
  for (const key of ["birthWeightG", "gestationalAgeWeeks", "apgar1", "apgar5"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    const meta = BIRTH_CODES[key];
    entries.push({
      fullUrl: `urn:uuid:${randomUUID()}`,
      resource: {
        ...base,
        code: { coding: [{ system: meta.system, code: meta.code, display: meta.display }] },
        valueQuantity: { value, unit: meta.unit, system: "http://unitsofmeasure.org", code: meta.unit },
      },
      request: { method: "POST", url: "Observation" },
    });
  }
  if (input.deliveryMode) {
    entries.push({
      fullUrl: `urn:uuid:${randomUUID()}`,
      resource: { ...base, code: { coding: [DELIVERY_CODE] }, valueString: input.deliveryMode },
      request: { method: "POST", url: "Observation" },
    });
  }
  return { resourceType: "Bundle", type: "transaction", entry: entries };
}

interface FhirObservation {
  code?: { coding?: { code?: string }[] };
  valueQuantity?: { value?: number };
  valueString?: string;
}

export function fromBirthBundle(bundle: { entry?: { resource: FhirObservation }[] }): BirthRecord | null {
  const observations = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean);
  const byCode = (code: string) => observations.find((o) => o.code?.coding?.some((c) => c.code === code));
  const weight = byCode(BIRTH_CODES.birthWeightG.code)?.valueQuantity?.value;
  if (weight === undefined) return null;
  const mode = byCode(DELIVERY_CODE.code)?.valueString;
  const record: BirthInput = {
    birthWeightG: weight,
    gestationalAgeWeeks: byCode(BIRTH_CODES.gestationalAgeWeeks.code)?.valueQuantity?.value,
    apgar1: byCode(BIRTH_CODES.apgar1.code)?.valueQuantity?.value,
    apgar5: byCode(BIRTH_CODES.apgar5.code)?.valueQuantity?.value,
    deliveryMode: (DELIVERY_MODES as readonly string[]).includes(mode ?? "") ? (mode as DeliveryMode) : undefined,
  };
  return { ...record, alerts: birthAlerts(record) };
}
