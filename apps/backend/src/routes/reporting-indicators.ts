import { DIAGNOSES } from "../lib/diagnoses.js";
import { fetchAll } from "../lib/fhir-search.js";
import { hapiClient } from "../lib/hapi-client.js";
import { IMAGING_CATEGORY_SEARCH_TOKEN } from "../lib/service-category.js";
import { type EncounterFact, buildIndicators, periodRange } from "../lib/dhis2.js";

type Json = Record<string, unknown>;

async function countOf(path: string): Promise<number> {
  const bundle = await hapiClient.get<{ total?: number }>(`${path}&_summary=count`, { "Cache-Control": "no-cache" });
  return bundle.total ?? 0;
}

// Calcule les indicateurs d'activité d'un mois (AAAAMM) à partir des ressources FHIR.
export async function computeMonthlyIndicators(period: string): Promise<Record<string, number>> {
  const { start, end } = periodRange(period);
  const between = (param: string) => `${param}=ge${start}&${param}=lt${end}`;

  const [encounterResources, hospitalisations, labRequests, labReports, imagingReports, immunizations, conditions] =
    await Promise.all([
      fetchAll<Json>(`/Encounter?class=AMB&${between("date")}&_include=Encounter:subject`),
      countOf(`/Encounter?class=IMP&${between("date")}`),
      countOf(`/ServiceRequest?${between("authored")}&category:not=${IMAGING_CATEGORY_SEARCH_TOKEN}`),
      countOf(`/DiagnosticReport?${between("issued")}&category:not=${IMAGING_CATEGORY_SEARCH_TOKEN}`),
      countOf(`/DiagnosticReport?${between("issued")}&category=${IMAGING_CATEGORY_SEARCH_TOKEN}`),
      countOf(`/Immunization?${between("date")}`),
      fetchAll<Json>(`/Condition?${between("recorded-date")}`),
    ]);

  const patients = new Map(
    encounterResources
      .filter((r) => r.resourceType === "Patient")
      .map((r) => [String(r.id), r as { birthDate?: string; gender?: string }]),
  );
  const consultations: EncounterFact[] = encounterResources
    .filter((r) => r.resourceType === "Encounter")
    .map((r) => {
      const encounter = r as { subject?: { reference?: string }; period?: { start?: string } };
      const patient = patients.get(encounter.subject?.reference?.split("/")[1] ?? "");
      return { date: encounter.period?.start ?? start, birthDate: patient?.birthDate, gender: patient?.gender };
    });

  const diagnosisCodes = conditions.map(
    (c) => (c as { code?: { coding?: { code?: string }[] } }).code?.coding?.[0]?.code,
  );

  return buildIndicators({ consultations, hospitalisations, labRequests, labReports, imagingReports, immunizations, diagnosisCodes });
}

export const DIAGNOSIS_NAMES: Record<string, string> = Object.fromEntries(DIAGNOSES.map((d) => [d.code, d.display]));
