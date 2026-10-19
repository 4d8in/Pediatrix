import { VITAL_LOINC_CODES } from "./vitals-codes.js";
import { PLAUSIBLE_RANGES, checkRange } from "./validation.js";

// Constantes prises au tri : un résumé dans la file, avec mise en évidence des valeurs critiques.
export const SPO2 = { code: "59408-5", display: "Saturation en oxygène (oxymétrie)", unit: "%" } as const;

export const TRIAGE_VITAL_KEYS = ["temperature", "heartRate", "respiratoryRate", "spo2"] as const;
export type TriageVitalKey = (typeof TRIAGE_VITAL_KEYS)[number];
export type TriageVitals = Partial<Record<TriageVitalKey, number>>;

const CODING: Record<TriageVitalKey, { code: string; display: string; unit: string }> = {
  temperature: VITAL_LOINC_CODES.temperature,
  heartRate: VITAL_LOINC_CODES.heartRate,
  respiratoryRate: VITAL_LOINC_CODES.respiratoryRate,
  spo2: SPO2,
};
const LABELS: Record<TriageVitalKey, string> = {
  temperature: "Température",
  heartRate: "Fréquence cardiaque",
  respiratoryRate: "Fréquence respiratoire",
  spo2: "Saturation en oxygène",
};
const SPO2_RANGE = { min: 30, max: 100, unit: "%" };

export const TRIAGE_VITAL_CODES = TRIAGE_VITAL_KEYS.map((key) => CODING[key].code);

// Valide les constantes saisies ; renvoie les valeurs retenues ou des erreurs.
export function parseTriageVitals(raw: unknown): { vitals: TriageVitals } | { errors: string[] } {
  if (raw === undefined || raw === null) return { vitals: {} };
  const b = raw as Record<string, unknown>;
  const vitals: TriageVitals = {};
  const errors: string[] = [];
  for (const key of TRIAGE_VITAL_KEYS) {
    const input = b[key];
    if (input === undefined || input === null || input === "") continue;
    const value = typeof input === "number" ? input : Number(String(input).replace(",", "."));
    const range = key === "spo2" ? SPO2_RANGE : PLAUSIBLE_RANGES[key];
    const error = checkRange(value, range, LABELS[key]);
    if (error) errors.push(error);
    else vitals[key] = value;
  }
  return errors.length > 0 ? { errors } : { vitals };
}

export function toTriageVitalObservations(patientId: string, encounterId: string, vitals: TriageVitals, performer: { id: string; name: string }, at?: string) {
  const now = at ?? new Date().toISOString();
  return TRIAGE_VITAL_KEYS.filter((key) => vitals[key] !== undefined).map((key) => ({
    resourceType: "Observation",
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
    code: { coding: [{ system: "http://loinc.org", code: CODING[key].code, display: CODING[key].display }] },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    effectiveDateTime: now,
    performer: [{ reference: `Practitioner/${performer.id}`, display: performer.name }],
    valueQuantity: { value: vitals[key], unit: CODING[key].unit, system: "http://unitsofmeasure.org", code: CODING[key].unit },
  }));
}

// Seuils d'alerte indépendants de l'âge, volontairement prudents (hypothèse « à valider »
// par un pédiatre : fréquences cardiaque et respiratoire dépendent de l'âge, non jugées ici).
export function criticalVitals(vitals: TriageVitals): TriageVitalKey[] {
  const critical: TriageVitalKey[] = [];
  if (vitals.spo2 !== undefined && vitals.spo2 < 90) critical.push("spo2");
  if (vitals.temperature !== undefined && (vitals.temperature >= 39.5 || vitals.temperature < 35.5)) critical.push("temperature");
  return critical;
}

interface FhirVitalObservation {
  encounter?: { reference?: string };
  effectiveDateTime?: string;
  code?: { coding?: { code?: string }[] };
  valueQuantity?: { value?: number };
}

// Dernière valeur de chaque constante de tri, par consultation (clé = id d'Encounter).
export function latestVitalsByEncounter(observations: FhirVitalObservation[]): Map<string, TriageVitals> {
  const keyByCode = new Map(TRIAGE_VITAL_KEYS.map((key) => [CODING[key].code, key]));
  const sorted = [...observations].sort((a, b) => (a.effectiveDateTime ?? "").localeCompare(b.effectiveDateTime ?? ""));
  const result = new Map<string, TriageVitals>();
  for (const obs of sorted) {
    const encounterId = obs.encounter?.reference?.split("/")[1];
    const key = keyByCode.get(obs.code?.coding?.[0]?.code ?? "");
    const value = obs.valueQuantity?.value;
    if (!encounterId || !key || typeof value !== "number") continue;
    result.set(encounterId, { ...result.get(encounterId), [key]: value });
  }
  return result;
}
