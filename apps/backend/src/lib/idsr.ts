import { ageInMonths } from "./nutrition.js";

// Surveillance épidémiologique hebdomadaire (approche IDSR de l'OMS Afrique) : cas des maladies
// prioritaires comptés par semaine à partir des diagnostics CIM-10 saisis en consultation.
// La liste des maladies à déclaration immédiate ou hebdomadaire DIFFÈRE selon le pays : celle-ci est
// une liste de départ identifiée de mémoire, à remplacer par la liste nationale (ministère de la
// santé) avant un usage réel. Les seuils d'alerte sont une heuristique simple, à valider.
export type Tier = "immediate" | "weekly";

export interface PriorityDisease {
  key: string;
  label: string;
  tier: Tier;
  // Préfixes CIM-10 (comparés sans point, en majuscules) : « B50 » couvre B50.0, B50.9…
  prefixes: string[];
}

export const PRIORITY_DISEASES: PriorityDisease[] = [
  { key: "cholera", label: "Choléra", tier: "immediate", prefixes: ["A00"] },
  { key: "measles", label: "Rougeole", tier: "immediate", prefixes: ["B05"] },
  { key: "polio", label: "Poliomyélite aiguë / paralysie flasque aiguë", tier: "immediate", prefixes: ["A80"] },
  { key: "plague", label: "Peste", tier: "immediate", prefixes: ["A20"] },
  { key: "rabies", label: "Rage", tier: "immediate", prefixes: ["A82"] },
  { key: "vhf", label: "Fièvre hémorragique virale (Ebola, Marburg, Lassa)", tier: "immediate", prefixes: ["A98", "A96"] },
  { key: "yellow_fever", label: "Fièvre jaune", tier: "immediate", prefixes: ["A95"] },
  { key: "diphtheria", label: "Diphtérie", tier: "immediate", prefixes: ["A36"] },
  { key: "neonatal_tetanus", label: "Tétanos néonatal", tier: "immediate", prefixes: ["A33"] },
  { key: "meningitis", label: "Méningite", tier: "immediate", prefixes: ["G00", "A39"] },
  { key: "malaria", label: "Paludisme", tier: "weekly", prefixes: ["B50", "B51", "B52", "B53", "B54"] },
  { key: "diarrhoea", label: "Diarrhée aiguë", tier: "weekly", prefixes: ["A09"] },
  { key: "pneumonia", label: "Pneumonie", tier: "weekly", prefixes: ["J18", "J15"] },
  { key: "typhoid", label: "Fièvre typhoïde", tier: "weekly", prefixes: ["A01"] },
  { key: "pertussis", label: "Coqueluche", tier: "weekly", prefixes: ["A37"] },
  { key: "dengue", label: "Dengue", tier: "weekly", prefixes: ["A90", "A91"] },
  { key: "tuberculosis", label: "Tuberculose", tier: "weekly", prefixes: ["A15", "A16", "A17", "A18", "A19"] },
  { key: "hiv", label: "Infection à VIH", tier: "weekly", prefixes: ["B20", "B21", "B22", "B23", "B24", "Z21"] },
  { key: "sam", label: "Malnutrition aiguë sévère", tier: "weekly", prefixes: ["E40", "E41", "E42", "E43"] },
];

export function diseaseOf(icdCode: string | undefined | null): PriorityDisease | undefined {
  if (!icdCode) return undefined;
  const code = icdCode.replace(".", "").toUpperCase();
  return PRIORITY_DISEASES.find((d) => d.prefixes.some((prefix) => code.startsWith(prefix)));
}

// --- Semaines ISO (lundi au dimanche, en UTC) ---------------------------------------------------

export function parseIsoWeek(week: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/.exec(week);
  if (!m) return null;
  const year = Number(m[1]);
  const wk = Number(m[2]);
  // Le 4 janvier est toujours dans la semaine 1 ISO.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // lundi = 0
  const start = new Date(Date.UTC(year, 0, 4 - jan4Dow + (wk - 1) * 7));
  // Une semaine 53 inexistante pour cette année est refusée.
  const check = isoWeekOf(start);
  if (check !== `${year}-W${m[2]}`) return null;
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}

export function isoWeekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3); // jeudi de la semaine
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// --- Comptage ------------------------------------------------------------------------------------

export interface CaseFact {
  icdCode: string;
  recordedAt: string;
  confirmed: boolean;
  birthDate?: string;
  sex?: string;
}

export interface SurveillanceRow {
  key: string;
  label: string;
  tier: Tier;
  cases: number;
  confirmed: number;
  underFive: number;
  // Moyenne hebdomadaire des 4 semaines précédentes.
  previousAverage: number;
  alert: "immediate" | "threshold" | null;
}

export interface ImmediateCase {
  disease: string;
  code: string;
  date: string;
  ageMonths: number | null;
  sex: string;
}

export const THRESHOLD_MIN_CASES = 5;
export const THRESHOLD_RATIO = 2;

export function weeklySurveillance(
  facts: CaseFact[],
  week: { start: Date; end: Date },
): { rows: SurveillanceRow[]; immediateCases: ImmediateCase[] } {
  const startMs = week.start.getTime();
  const endMs = week.end.getTime();
  const previousStartMs = startMs - 4 * 7 * 86_400_000;

  const rows: SurveillanceRow[] = PRIORITY_DISEASES.map((d) => ({
    key: d.key,
    label: d.label,
    tier: d.tier,
    cases: 0,
    confirmed: 0,
    underFive: 0,
    previousAverage: 0,
    alert: null,
  }));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const previousTotals = new Map<string, number>();
  const immediateCases: ImmediateCase[] = [];

  for (const fact of facts) {
    const disease = diseaseOf(fact.icdCode);
    const at = Date.parse(fact.recordedAt);
    if (!disease || Number.isNaN(at)) continue;
    const row = byKey.get(disease.key)!;
    if (at >= startMs && at < endMs) {
      row.cases += 1;
      if (fact.confirmed) row.confirmed += 1;
      const months = fact.birthDate ? ageInMonths(fact.birthDate, fact.recordedAt) : null;
      if (months !== null && months < 60) row.underFive += 1;
      if (disease.tier === "immediate") {
        immediateCases.push({
          disease: disease.label,
          code: fact.icdCode,
          date: fact.recordedAt,
          ageMonths: months,
          sex: fact.sex ?? "unknown",
        });
      }
    } else if (at >= previousStartMs && at < startMs) {
      previousTotals.set(disease.key, (previousTotals.get(disease.key) ?? 0) + 1);
    }
  }

  for (const row of rows) {
    row.previousAverage = Math.round(((previousTotals.get(row.key) ?? 0) / 4) * 10) / 10;
    if (row.tier === "immediate" && row.cases >= 1) row.alert = "immediate";
    else if (row.cases >= THRESHOLD_MIN_CASES && row.cases >= THRESHOLD_RATIO * row.previousAverage) row.alert = "threshold";
  }
  immediateCases.sort((a, b) => b.date.localeCompare(a.date));
  return { rows, immediateCases };
}
