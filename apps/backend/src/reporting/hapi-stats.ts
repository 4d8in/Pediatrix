import { hapiClient } from "../lib/hapi-client.js";

interface CountBundle {
  total?: number;
}

async function countResource(resourceType: string, extraParams = ""): Promise<number> {
  const bundle = await hapiClient.get<CountBundle>(`/${resourceType}?_summary=count${extraParams}`);
  return bundle.total ?? 0;
}

export async function countTotaux() {
  const [nbPatients, nbConsultations, nbDemandesExamen, nbRapports] = await Promise.all([
    countResource("Patient"),
    countResource("Encounter", "&class=AMB"),
    countResource("ServiceRequest"),
    countResource("DiagnosticReport"),
  ]);
  return { nbPatients, nbConsultations, nbDemandesExamen, nbRapports };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Une requête _summary=count par jour de la fenêtre : plus de requêtes qu'un
// group-by, mais évite de paginer/parser les Encounter complets pour un simple
// compteur — plus simple à expliquer, adapté au volume d'un hôpital de district.
export async function countConsultationsParJour(windowDays: number): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const today = new Date();

  for (let i = 0; i < windowDays; i++) {
    const dayStart = new Date(today);
    dayStart.setUTCDate(dayStart.getUTCDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const dayStartStr = toDateOnly(dayStart);
    const nb = await countResource("Encounter", `&class=AMB&date=ge${dayStartStr}&date=lt${toDateOnly(dayEnd)}`);
    result[dayStartStr] = nb;
  }

  return result;
}

interface FhirServiceRequestElement {
  resourceType: "ServiceRequest";
  code?: { text?: string };
}

interface FhirBundlePage {
  entry?: { resource: FhirServiceRequestElement }[];
  link?: { relation?: string; url?: string }[];
}

// ServiceRequest.code.text est du texte libre (pas de terminologie codée pour
// les examens ici) : impossible de demander à HAPI un group-by par type, donc
// on paginе tous les ServiceRequest (_elements=code réduit la charge) et on
// agrège en mémoire. Suffisant au volume d'un hôpital de district ; ne
// passerait pas à l'échelle d'un plus gros établissement.
export async function countExamensParType(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  let bundle = await hapiClient.get<FhirBundlePage>("/ServiceRequest?_elements=code&_count=100");

  while (true) {
    for (const entry of bundle.entry ?? []) {
      const label = entry.resource.code?.text ?? "Non précisé";
      result[label] = (result[label] ?? 0) + 1;
    }

    const nextUrl = bundle.link?.find((link) => link.relation === "next")?.url;
    if (!nextUrl) break;

    const response = await fetch(nextUrl, { headers: { Accept: "application/fhir+json" } });
    if (!response.ok) {
      throw new Error(`HAPI a répondu ${response.status} lors de la pagination des ServiceRequest.`);
    }
    bundle = (await response.json()) as FhirBundlePage;
  }

  return result;
}
