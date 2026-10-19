// Garde-fou de dose pédiatrique : dose quotidienne maximale par kg pour quelques
// médicaments du formulaire. Valeurs courantes identifiées de mémoire, volontairement
// simples (pas d'âge, pas de fonction rénale) : à faire valider par le pharmacien
// responsable avant un usage réel. Le médecin peut toujours confirmer malgré l'alerte.
export interface DoseRule {
  formularyCode: string;
  maxDailyMgPerKg: number;
  // Plafond absolu par jour (mg), pour un grand enfant dont le poids donnerait une dose d'adulte excessive.
  maxDailyMg?: number;
  // Contre-indication : âge minimal (mois) ou poids minimal (kg).
  minAgeMonths?: number;
  minWeightKg?: number;
}

export const DOSE_RULES: DoseRule[] = [
  { formularyCode: "PARA-SIR", maxDailyMgPerKg: 60, maxDailyMg: 4000 },
  { formularyCode: "PARA-CP", maxDailyMgPerKg: 60, maxDailyMg: 4000 },
  { formularyCode: "IBU-SIR", maxDailyMgPerKg: 30, maxDailyMg: 1200, minAgeMonths: 3, minWeightKg: 5 },
  { formularyCode: "AMOX-SUS", maxDailyMgPerKg: 90, maxDailyMg: 3000 },
  { formularyCode: "AMOX-DISP", maxDailyMgPerKg: 90, maxDailyMg: 3000 },
  { formularyCode: "GENTA-80", maxDailyMgPerKg: 7.5 },
];

// Un poids plus ancien que ce délai n'est plus fiable pour un enfant qui grandit.
export const WEIGHT_MAX_AGE_DAYS = 30;

export function hasDoseRule(formularyCode: string): boolean {
  return DOSE_RULES.some((r) => r.formularyCode === formularyCode);
}

export interface DoseCheck {
  message: string;
}

export interface DoseContext {
  // Date de la mesure du poids, et âge de l'enfant en mois : alertes de poids périmé et de contre-indication.
  weightDate?: string;
  ageMonths?: number | null;
  now?: Date;
}

// Renvoie une alerte (messages regroupés) si la dose quotidienne dépasse le maximum par kg ou le plafond
// absolu, si le médicament est contre-indiqué à cet âge ou ce poids, si le poids manque ou date trop.
// Un médicament sans règle n'est pas vérifié (renvoie null).
export function checkDailyDose(
  formularyCode: string,
  doseMg: number,
  dosesPerDay: number,
  weightKg: number | undefined,
  context: DoseContext = {},
): DoseCheck | null {
  const rule = DOSE_RULES.find((r) => r.formularyCode === formularyCode);
  if (!rule) return null;
  const messages: string[] = [];

  if (rule.minAgeMonths !== undefined && context.ageMonths != null && context.ageMonths < rule.minAgeMonths) {
    messages.push(`Médicament déconseillé avant ${rule.minAgeMonths} mois (enfant de ${context.ageMonths} mois).`);
  }
  if (weightKg === undefined || weightKg <= 0) {
    messages.push("Poids de l'enfant inconnu : la dose ne peut pas être vérifiée.");
  } else {
    if (rule.minWeightKg !== undefined && weightKg < rule.minWeightKg) {
      messages.push(`Médicament déconseillé sous ${rule.minWeightKg} kg (poids ${weightKg} kg).`);
    }
    const perKg = (doseMg * dosesPerDay) / weightKg;
    if (perKg > rule.maxDailyMgPerKg) {
      messages.push(
        `Dose quotidienne ${Math.round(perKg * 10) / 10} mg/kg au-dessus du maximum usuel de ${rule.maxDailyMgPerKg} mg/kg/jour (poids ${weightKg} kg).`,
      );
    }
    if (context.weightDate) {
      const ageDays = ((context.now ?? new Date()).getTime() - Date.parse(context.weightDate)) / 86_400_000;
      if (ageDays > WEIGHT_MAX_AGE_DAYS) {
        messages.push(`Dernier poids enregistré il y a ${Math.floor(ageDays)} jours : à vérifier avant de prescrire.`);
      }
    }
  }
  const daily = doseMg * dosesPerDay;
  if (rule.maxDailyMg !== undefined && daily > rule.maxDailyMg) {
    messages.push(`Dose quotidienne ${daily} mg au-dessus du plafond de ${rule.maxDailyMg} mg/jour.`);
  }
  return messages.length > 0 ? { message: `${messages.join(" ")} Confirmez pour prescrire quand même.` } : null;
}
