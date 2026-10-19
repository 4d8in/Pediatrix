// Registre de naissance du nouveau-né : poids de naissance, âge gestationnel, score d'Apgar
// (1 et 5 minutes) et mode d'accouchement. Un seul enregistrement par enfant.
// Seuils d'alerte (poids < 2500 g, < 1500 g, prématurité < 37 semaines, Apgar à 5 min < 7)
// : repères usuels écrits de mémoire, à faire valider par un pédiatre.
export const BIRTH_CATEGORY_SYSTEM = "http://pediatrix.local/fhir/observation-category";
export const BIRTH_CATEGORY_CODE = "birth-record";
export const BIRTH_CATEGORY_SEARCH_TOKEN = `${BIRTH_CATEGORY_SYSTEM}|${BIRTH_CATEGORY_CODE}`;

export const DELIVERY_MODES = ["vaginal", "caesarean", "assisted"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export const DELIVERY_LABELS: Record<DeliveryMode, string> = {
  vaginal: "Voie basse",
  caesarean: "Césarienne",
  assisted: "Voie basse instrumentale",
};

export interface BirthInput {
  birthWeightG: number;
  gestationalAgeWeeks?: number;
  apgar1?: number;
  apgar5?: number;
  deliveryMode?: DeliveryMode;
}

export interface BirthRecord extends BirthInput {
  alerts: BirthAlert[];
}

export type BirthAlert = "very_low_birth_weight" | "low_birth_weight" | "preterm" | "low_apgar";

export const BIRTH_CODES = {
  birthWeightG: { system: "http://loinc.org", code: "8339-4", display: "Poids de naissance", unit: "g" },
  gestationalAgeWeeks: { system: "http://loinc.org", code: "18185-9", display: "Âge gestationnel", unit: "wk" },
  apgar1: { system: "http://loinc.org", code: "9272-6", display: "Apgar à 1 minute", unit: "{score}" },
  apgar5: { system: "http://loinc.org", code: "9274-2", display: "Apgar à 5 minutes", unit: "{score}" },
} as const;

export const DELIVERY_CODE = { system: "http://pediatrix.local/fhir/measure", code: "delivery-mode", display: "Mode d'accouchement" } as const;

export function birthAlerts(record: BirthInput): BirthAlert[] {
  const alerts: BirthAlert[] = [];
  if (record.birthWeightG < 1500) alerts.push("very_low_birth_weight");
  else if (record.birthWeightG < 2500) alerts.push("low_birth_weight");
  if (record.gestationalAgeWeeks !== undefined && record.gestationalAgeWeeks < 37) alerts.push("preterm");
  if (record.apgar5 !== undefined && record.apgar5 < 7) alerts.push("low_apgar");
  return alerts;
}

function integerIn(value: unknown, min: number, max: number): number | undefined | "invalid" {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : "invalid";
}

export function validateBirth(body: unknown): { input: BirthInput } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const weight = integerIn(b.birthWeightG, 300, 7000);
  if (weight === undefined) errors.push("Le poids de naissance (en grammes) est requis.");
  else if (weight === "invalid") errors.push("Le poids de naissance doit être un entier entre 300 et 7000 g.");
  const gestation = integerIn(b.gestationalAgeWeeks, 20, 45);
  if (gestation === "invalid") errors.push("L'âge gestationnel doit être un entier entre 20 et 45 semaines.");
  const apgar1 = integerIn(b.apgar1, 0, 10);
  if (apgar1 === "invalid") errors.push("L'Apgar à 1 minute doit être un entier entre 0 et 10.");
  const apgar5 = integerIn(b.apgar5, 0, 10);
  if (apgar5 === "invalid") errors.push("L'Apgar à 5 minutes doit être un entier entre 0 et 10.");
  let deliveryMode: DeliveryMode | undefined;
  if (b.deliveryMode !== undefined && b.deliveryMode !== "") {
    if (typeof b.deliveryMode === "string" && (DELIVERY_MODES as readonly string[]).includes(b.deliveryMode)) {
      deliveryMode = b.deliveryMode as DeliveryMode;
    } else errors.push("Mode d'accouchement invalide.");
  }
  if (errors.length > 0) return { errors };
  return {
    input: {
      birthWeightG: weight as number,
      gestationalAgeWeeks: gestation as number | undefined,
      apgar1: apgar1 as number | undefined,
      apgar5: apgar5 as number | undefined,
      deliveryMode,
    },
  };
}
