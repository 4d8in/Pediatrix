// Dépistage de la malnutrition aiguë par le périmètre brachial (PB, « MUAC »),
// seuils OMS/UNICEF pour les enfants de 6 à 59 mois :
//   PB < 115 mm        -> malnutrition aiguë sévère
//   115 mm <= PB < 125 -> malnutrition aiguë modérée
//   PB >= 125 mm       -> normal
// Hors de cette tranche d'âge, ces seuils ne s'appliquent pas : pas de classement.
export type MuacStatus = "severe" | "moderate" | "normal";

export const MUAC_MIN_AGE_MONTHS = 6;
export const MUAC_MAX_AGE_MONTHS = 59;

export function ageInMonths(birthDate: string, atDate: string): number | null {
  const birth = new Date(birthDate);
  const at = new Date(atDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime()) || birth > at) return null;
  let months = (at.getUTCFullYear() - birth.getUTCFullYear()) * 12 + at.getUTCMonth() - birth.getUTCMonth();
  if (at.getUTCDate() < birth.getUTCDate()) months -= 1;
  return months;
}

export function classifyMuac(muacMm: number, birthDate: string, atDate: string): MuacStatus | null {
  const months = ageInMonths(birthDate, atDate);
  if (months === null || months < MUAC_MIN_AGE_MONTHS || months > MUAC_MAX_AGE_MONTHS) return null;
  if (muacMm < 115) return "severe";
  if (muacMm < 125) return "moderate";
  return "normal";
}
