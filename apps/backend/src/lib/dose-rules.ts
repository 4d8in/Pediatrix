// Garde-fou de dose pédiatrique : dose quotidienne maximale par kg pour quelques
// médicaments du formulaire. Valeurs courantes identifiées de mémoire, volontairement
// simples (pas d'âge, pas de fonction rénale) : à faire valider par le pharmacien
// responsable avant un usage réel. Le médecin peut toujours confirmer malgré l'alerte.
export interface DoseRule {
  formularyCode: string;
  maxDailyMgPerKg: number;
}

export const DOSE_RULES: DoseRule[] = [
  { formularyCode: "PARA-SIR", maxDailyMgPerKg: 60 },
  { formularyCode: "PARA-CP", maxDailyMgPerKg: 60 },
  { formularyCode: "IBU-SIR", maxDailyMgPerKg: 30 },
  { formularyCode: "AMOX-SUS", maxDailyMgPerKg: 90 },
  { formularyCode: "AMOX-DISP", maxDailyMgPerKg: 90 },
  { formularyCode: "GENTA-80", maxDailyMgPerKg: 7.5 },
];

export function hasDoseRule(formularyCode: string): boolean {
  return DOSE_RULES.some((r) => r.formularyCode === formularyCode);
}

export interface DoseCheck {
  message: string;
}

// Renvoie une alerte si la dose quotidienne dépasse le maximum par kg, ou si le poids manque.
// Un médicament sans règle n'est pas vérifié (renvoie null).
export function checkDailyDose(
  formularyCode: string,
  doseMg: number,
  dosesPerDay: number,
  weightKg: number | undefined,
): DoseCheck | null {
  const rule = DOSE_RULES.find((r) => r.formularyCode === formularyCode);
  if (!rule) return null;
  if (weightKg === undefined || weightKg <= 0) {
    return { message: "Poids de l'enfant inconnu : la dose ne peut pas être vérifiée. Confirmez pour prescrire quand même." };
  }
  const perKg = (doseMg * dosesPerDay) / weightKg;
  if (perKg > rule.maxDailyMgPerKg) {
    return {
      message: `Dose quotidienne ${Math.round(perKg * 10) / 10} mg/kg au-dessus du maximum usuel de ${rule.maxDailyMgPerKg} mg/kg/jour (poids ${weightKg} kg). Confirmez pour prescrire quand même.`,
    };
  }
  return null;
}
