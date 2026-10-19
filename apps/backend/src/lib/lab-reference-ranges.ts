// Valeurs de référence pédiatriques par tranche d'âge et par sexe, pour les analyses du
// catalogue. Valeurs courantes identifiées de mémoire : elles varient selon la méthode et
// l'automate du laboratoire, et doivent être validées par le biologiste responsable puis
// remplacées par les intervalles du laboratoire. Le technicien peut toujours les modifier.
// Les seuils critiques servent aux drapeaux HH / LL (action immédiate).
export interface ReferenceRange {
  low?: number;
  high?: number;
  criticalLow?: number;
  criticalHigh?: number;
}

interface RangeRule extends ReferenceRange {
  code: string;
  // Tranche d'âge en mois : minMonths inclus, maxMonths exclu.
  minMonths: number;
  maxMonths: number;
  sex?: "male" | "female";
}

const M = (years: number) => years * 12;

const RULES: RangeRule[] = [
  // Hémoglobine (g/dL)
  { code: "718-7", minMonths: 0, maxMonths: 1, low: 13.5, high: 21.5, criticalLow: 9 },
  { code: "718-7", minMonths: 1, maxMonths: 6, low: 9.5, high: 13.5, criticalLow: 7 },
  { code: "718-7", minMonths: 6, maxMonths: M(2), low: 10.5, high: 13.5, criticalLow: 7 },
  { code: "718-7", minMonths: M(2), maxMonths: M(6), low: 11.5, high: 13.5, criticalLow: 7 },
  { code: "718-7", minMonths: M(6), maxMonths: M(12), low: 11.5, high: 15.5, criticalLow: 7 },
  { code: "718-7", minMonths: M(12), maxMonths: M(19), sex: "female", low: 12, high: 16, criticalLow: 7 },
  { code: "718-7", minMonths: M(12), maxMonths: M(19), sex: "male", low: 13, high: 16, criticalLow: 7 },
  // Leucocytes (10*3/uL)
  { code: "6690-2", minMonths: 0, maxMonths: M(1), low: 6, high: 17.5, criticalLow: 2, criticalHigh: 50 },
  { code: "6690-2", minMonths: M(1), maxMonths: M(5), low: 5.5, high: 15.5, criticalLow: 2, criticalHigh: 50 },
  { code: "6690-2", minMonths: M(5), maxMonths: M(11), low: 4.5, high: 13.5, criticalLow: 2, criticalHigh: 50 },
  { code: "6690-2", minMonths: M(11), maxMonths: M(19), low: 4.5, high: 11, criticalLow: 2, criticalHigh: 50 },
  // Plaquettes (10*3/uL)
  { code: "777-3", minMonths: 0, maxMonths: M(19), low: 150, high: 450, criticalLow: 20, criticalHigh: 1000 },
  // Hématocrite (%)
  { code: "4544-3", minMonths: 6, maxMonths: M(2), low: 33, high: 39 },
  { code: "4544-3", minMonths: M(2), maxMonths: M(6), low: 34, high: 40 },
  { code: "4544-3", minMonths: M(6), maxMonths: M(12), low: 35, high: 45 },
  { code: "4544-3", minMonths: M(12), maxMonths: M(19), sex: "female", low: 36, high: 46 },
  { code: "4544-3", minMonths: M(12), maxMonths: M(19), sex: "male", low: 37, high: 49 },
  // Glycémie à jeun (mg/dL)
  { code: "2345-7", minMonths: 0, maxMonths: M(19), low: 70, high: 110, criticalLow: 40, criticalHigh: 400 },
  // CRP (mg/L)
  { code: "1988-5", minMonths: 0, maxMonths: M(19), high: 5 },
  // Créatinine (mg/dL)
  { code: "2160-0", minMonths: 0, maxMonths: M(1), low: 0.2, high: 0.4 },
  { code: "2160-0", minMonths: M(1), maxMonths: M(3), low: 0.2, high: 0.5 },
  { code: "2160-0", minMonths: M(3), maxMonths: M(12), low: 0.3, high: 0.7 },
  { code: "2160-0", minMonths: M(12), maxMonths: M(19), low: 0.5, high: 1.0 },
];

// Intervalle applicable à une analyse pour un enfant de cet âge (en mois) et de ce sexe.
export function referenceFor(code: string, ageMonths: number | null, sex: string): ReferenceRange | undefined {
  if (ageMonths === null || ageMonths < 0) return undefined;
  const rule = RULES.find(
    (r) =>
      r.code === code &&
      ageMonths >= r.minMonths &&
      ageMonths < r.maxMonths &&
      (r.sex === undefined || r.sex === sex),
  );
  if (!rule) return undefined;
  const { low, high, criticalLow, criticalHigh } = rule;
  return { low, high, criticalLow, criticalHigh };
}
