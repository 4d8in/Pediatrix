// Contrôles de saisie partagés par les routes. Les bornes sont volontairement
// larges : elles écartent les erreurs de frappe (ex. 385 °C au lieu de 38,5 °C),
// pas les valeurs cliniquement anormales, qui doivent rester saisissables.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Date au format AAAA-MM-JJ, valide et pas dans le futur. Renvoie un message
// d'erreur, ou null si la date est correcte.
export function checkPastDate(value: string, label: string): string | null {
  if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    return `${label} doit être au format AAAA-MM-JJ.`;
  }
  if (Date.parse(value) > Date.now()) {
    return `${label} ne peut pas être dans le futur.`;
  }
  return null;
}

export interface Range {
  min: number;
  max: number;
  unit: string;
}

// Bornes de vraisemblance en pédiatrie (0–18 ans).
export const PLAUSIBLE_RANGES = {
  temperature: { min: 30, max: 45, unit: "°C" },
  weight: { min: 0.3, max: 150, unit: "kg" },
  height: { min: 20, max: 220, unit: "cm" },
  heartRate: { min: 30, max: 250, unit: "/min" },
  respiratoryRate: { min: 5, max: 120, unit: "/min" },
  headCircumference: { min: 20, max: 70, unit: "cm" },
} satisfies Record<string, Range>;

// Valeur numérique dans les bornes. Renvoie un message d'erreur, ou null.
export function checkRange(value: number, range: Range, label: string): string | null {
  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    return `${label} doit être compris entre ${range.min} et ${range.max} ${range.unit}.`;
  }
  return null;
}
