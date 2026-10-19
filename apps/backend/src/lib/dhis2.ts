import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Rapport mensuel d'activité et export vers DHIS2 (système national d'information
// sanitaire agrégé, utilisé par le ministère de la Santé de nombreux pays).
// Les indicateurs sont calculés ici ; leur correspondance avec les éléments de
// données DHIS2 (identifiants propres à chaque pays) est réglée dans un fichier
// de correspondance, sans toucher au code.
const MAPPING_FILE = fileURLToPath(new URL("../../data/dhis2-mapping.json", import.meta.url));

const PERIOD_PATTERN = /^(\d{4})(0[1-9]|1[0-2])$/;

export function isValidPeriod(period: string): boolean {
  return PERIOD_PATTERN.test(period);
}

// Début (inclus) et fin (exclue) du mois, en ISO UTC.
export function periodRange(period: string): { start: string; end: string } {
  const match = PERIOD_PATTERN.exec(period);
  if (!match) throw new Error("Période invalide (AAAAMM attendu).");
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, month, 1)).toISOString(),
  };
}

export type AgeGroup = "lt1" | "1_4" | "5_14" | "15p";

// Tranche d'âge à la date de la consultation (âge en années révolues).
export function ageGroupOf(birthDate: string, atIso: string): AgeGroup | null {
  const birth = Date.parse(birthDate);
  const at = Date.parse(atIso);
  if (Number.isNaN(birth) || Number.isNaN(at) || birth > at) return null;
  const years = (at - birth) / (365.25 * 86_400_000);
  if (years < 1) return "lt1";
  if (years < 5) return "1_4";
  if (years < 15) return "5_14";
  return "15p";
}

export const INDICATOR_LABELS: Record<string, string> = {
  consultations: "Consultations (total)",
  consultations_lt1: "Consultations — moins de 1 an",
  consultations_1_4: "Consultations — 1 à 4 ans",
  consultations_5_14: "Consultations — 5 à 14 ans",
  consultations_15p: "Consultations — 15 ans et plus",
  consultations_male: "Consultations — garçons",
  consultations_female: "Consultations — filles",
  hospitalisations: "Hospitalisations (admissions)",
  lab_requests: "Examens de laboratoire demandés",
  lab_reports: "Résultats de laboratoire rendus",
  imaging_reports: "Comptes rendus d'imagerie",
  immunizations: "Vaccinations administrées",
};

export function indicatorLabel(id: string, diagnosisNames: Record<string, string> = {}): string {
  if (id.startsWith("dx_")) {
    const code = id.slice(3);
    return `Diagnostic ${code}${diagnosisNames[code] ? ` — ${diagnosisNames[code]}` : ""}`;
  }
  return INDICATOR_LABELS[id] ?? id;
}

export interface EncounterFact {
  date: string;
  birthDate?: string;
  gender?: string;
}

export interface IndicatorInputs {
  consultations: EncounterFact[];
  hospitalisations: number;
  labRequests: number;
  labReports: number;
  imagingReports: number;
  immunizations: number;
  // Un élément par diagnostic posé (code CIM-10, ou undefined pour un diagnostic libre).
  diagnosisCodes: (string | undefined)[];
}

export function buildIndicators(inputs: IndicatorInputs): Record<string, number> {
  const indicators: Record<string, number> = {
    consultations: inputs.consultations.length,
    consultations_lt1: 0,
    consultations_1_4: 0,
    consultations_5_14: 0,
    consultations_15p: 0,
    consultations_male: 0,
    consultations_female: 0,
    hospitalisations: inputs.hospitalisations,
    lab_requests: inputs.labRequests,
    lab_reports: inputs.labReports,
    imaging_reports: inputs.imagingReports,
    immunizations: inputs.immunizations,
  };

  for (const fact of inputs.consultations) {
    const group = fact.birthDate ? ageGroupOf(fact.birthDate, fact.date) : null;
    if (group) indicators[`consultations_${group}`] += 1;
    if (fact.gender === "male") indicators.consultations_male += 1;
    if (fact.gender === "female") indicators.consultations_female += 1;
  }

  for (const code of inputs.diagnosisCodes) {
    if (!code) continue;
    indicators[`dx_${code}`] = (indicators[`dx_${code}`] ?? 0) + 1;
  }
  return indicators;
}

export interface Dhis2Mapping {
  orgUnit: string;
  dataSet?: string;
  // Identifiant d'indicateur Pédiatrix -> identifiant d'élément de données DHIS2.
  dataElements: Record<string, string>;
}

export interface DataValueSet {
  dataSet?: string;
  period: string;
  orgUnit: string;
  completeDate: string;
  dataValues: { dataElement: string; value: string }[];
}

export function buildDataValueSet(
  period: string,
  indicators: Record<string, number>,
  mapping: Dhis2Mapping,
  completeDate: string = new Date().toISOString().slice(0, 10),
): { dataValueSet: DataValueSet; unmapped: string[] } {
  const dataValues: DataValueSet["dataValues"] = [];
  const unmapped: string[] = [];
  for (const [id, value] of Object.entries(indicators)) {
    const dataElement = mapping.dataElements[id];
    if (dataElement) dataValues.push({ dataElement, value: String(value) });
    else unmapped.push(id);
  }
  return {
    dataValueSet: { dataSet: mapping.dataSet, period, orgUnit: mapping.orgUnit, completeDate, dataValues },
    unmapped,
  };
}

const UID_PATTERN = /^[A-Za-z][A-Za-z0-9]{10}$/;

// Un identifiant DHIS2 (UID) fait 11 caractères alphanumériques et commence par une lettre.
export function validateMapping(raw: unknown): { mapping: Dhis2Mapping } | { errors: string[] } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const orgUnit = typeof b.orgUnit === "string" ? b.orgUnit.trim() : "";
  const dataSet = typeof b.dataSet === "string" && b.dataSet.trim() ? b.dataSet.trim() : undefined;
  if (!UID_PATTERN.test(orgUnit)) errors.push("orgUnit : identifiant DHIS2 de l'unité d'organisation invalide (11 caractères).");
  if (dataSet && !UID_PATTERN.test(dataSet)) errors.push("dataSet : identifiant DHIS2 invalide (11 caractères).");

  const dataElements: Record<string, string> = {};
  for (const [id, uid] of Object.entries((b.dataElements ?? {}) as Record<string, unknown>)) {
    if (typeof uid !== "string" || !UID_PATTERN.test(uid.trim())) errors.push(`dataElements.${id} : identifiant DHIS2 invalide.`);
    else dataElements[id] = uid.trim();
  }
  if (errors.length > 0) return { errors };
  return { mapping: { orgUnit, dataSet, dataElements } };
}

export async function loadMapping(): Promise<Dhis2Mapping | null> {
  try {
    return JSON.parse(await readFile(MAPPING_FILE, "utf-8")) as Dhis2Mapping;
  } catch {
    return null;
  }
}

export async function saveMapping(mapping: Dhis2Mapping): Promise<void> {
  await mkdir(dirname(MAPPING_FILE), { recursive: true });
  await writeFile(MAPPING_FILE, JSON.stringify(mapping, null, 2));
}

export async function clearMapping(): Promise<void> {
  await rm(MAPPING_FILE, { force: true });
}
