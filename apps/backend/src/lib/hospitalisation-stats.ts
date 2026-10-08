import { HapiError, hapiClient } from "./hapi-client.js";

// Indicateurs de lits et de séjours, calculés à partir des ressources FHIR du
// module Hospitalisation (lits = Location "bd", séjours = Encounter classe IMP).
// Partagé par /api/stats et /api/dashboard/overview.

interface FhirBundlePage {
  entry?: { resource: FhirResource }[];
  link?: { relation?: string; url?: string }[];
}

interface FhirResource {
  id?: string;
  name?: string;
  partOf?: { reference?: string };
  status?: string;
  period?: { start?: string; end?: string };
  operationalStatus?: { code?: string };
  physicalType?: { coding?: { code?: string }[] };
}

async function fetchAll(path: string): Promise<FhirResource[]> {
  const resources: FhirResource[] = [];
  let bundle = await hapiClient.get<FhirBundlePage>(path, { "Cache-Control": "no-cache" });
  while (true) {
    resources.push(...(bundle.entry ?? []).map((entry) => entry.resource));
    const nextUrl = bundle.link?.find((link) => link.relation === "next")?.url;
    if (!nextUrl) break;
    const response = await fetch(nextUrl, { headers: { Accept: "application/fhir+json", "Cache-Control": "no-cache" } });
    if (!response.ok) throw new HapiError(response.status, `HAPI a répondu ${response.status} lors de la pagination.`);
    bundle = (await response.json()) as FhirBundlePage;
  }
  return resources;
}

export interface HospitalisationStats {
  litsTotal: number;
  litsOccupes: number;
  sejoursEnCours: number;
  sejoursTotal: number;
  // Durée moyenne des séjours terminés, en jours (null s'il n'y en a aucun).
  dureeMoyenneJours: number | null;
  // Occupation des lits service par service.
  parService: { service: string; total: number; occupes: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeHospitalisationStats(): Promise<HospitalisationStats> {
  const [locations, stays] = await Promise.all([
    fetchAll("/Location?_elements=name,partOf,operationalStatus,physicalType&_count=200"),
    fetchAll("/Encounter?class=IMP&_elements=status,period&_count=200"),
  ]);

  const isType = (location: FhirResource, code: string) =>
    location.physicalType?.coding?.some((coding) => coding.code === code) ?? false;
  const beds = locations.filter((location) => isType(location, "bd"));
  const parService = locations
    .filter((location) => isType(location, "wa"))
    .map((ward) => {
      const wardBeds = beds.filter((bed) => bed.partOf?.reference === `Location/${ward.id}`);
      return {
        service: ward.name ?? ward.id ?? "Service",
        total: wardBeds.length,
        occupes: wardBeds.filter((bed) => bed.operationalStatus?.code === "O").length,
      };
    });
  const finished = stays.filter((stay) => stay.status === "finished" && stay.period?.start && stay.period?.end);
  const totalDays = finished.reduce(
    (sum, stay) => sum + (new Date(stay.period!.end!).getTime() - new Date(stay.period!.start!).getTime()) / DAY_MS,
    0,
  );

  return {
    litsTotal: beds.length,
    litsOccupes: beds.filter((bed) => bed.operationalStatus?.code === "O").length,
    sejoursEnCours: stays.filter((stay) => stay.status === "in-progress").length,
    sejoursTotal: stays.length,
    dureeMoyenneJours: finished.length > 0 ? Math.round((totalDays / finished.length) * 10) / 10 : null,
    parService,
  };
}

// Activité mensuelle de l'année civile en cours, par type d'activité.
export interface MonthlyActivity {
  consultations: number[];
  examensLabo: number[];
  examensImagerie: number[];
  hospitalisations: number[];
}

interface DatedResource {
  period?: { start?: string };
  authoredOn?: string;
  category?: { coding?: { code?: string }[] }[];
}

export async function computeMonthlyActivity(imagingCategoryCode: string): Promise<MonthlyActivity> {
  const year = new Date().getUTCFullYear();
  const perMonth = (dates: (string | undefined)[]) => {
    const counts = new Array<number>(12).fill(0);
    for (const date of dates) {
      if (!date) continue;
      const parsed = new Date(date);
      if (parsed.getUTCFullYear() === year) counts[parsed.getUTCMonth()] += 1;
    }
    return counts;
  };

  const [consultations, requests, stays] = (await Promise.all([
    fetchAll(`/Encounter?class=AMB&date=ge${year}-01-01&_elements=period&_count=200`),
    fetchAll(`/ServiceRequest?authored=ge${year}-01-01&_elements=authoredOn,category&_count=200`),
    fetchAll(`/Encounter?class=IMP&date=ge${year}-01-01&_elements=period&_count=200`),
  ])) as DatedResource[][];

  const isImaging = (request: DatedResource) =>
    request.category?.some((cat) => cat.coding?.some((coding) => coding.code === imagingCategoryCode)) ?? false;

  return {
    consultations: perMonth(consultations.map((encounter) => encounter.period?.start)),
    examensLabo: perMonth(requests.filter((request) => !isImaging(request)).map((request) => request.authoredOn)),
    examensImagerie: perMonth(requests.filter(isImaging).map((request) => request.authoredOn)),
    hospitalisations: perMonth(stays.map((stay) => stay.period?.start)),
  };
}
