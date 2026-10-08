import { hapiClient } from "./hapi-client.js";

// Compteurs du jour d'un service prestataire (laboratoire ou imagerie) :
// demandes en attente, résultats rendus aujourd'hui, délai moyen de rendu
// (entre la demande et le compte-rendu) sur les 30 derniers jours.
// `categoryFilter` isole les ressources du service (voir service-category.ts).

interface FhirBundle {
  total?: number;
  entry?: { resource: FhirResource }[];
}

interface FhirResource {
  resourceType: string;
  id: string;
  issued?: string;
  authoredOn?: string;
  basedOn?: { reference?: string }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const noCache = { "Cache-Control": "no-cache" };

export interface RequestSummary {
  enAttente: number;
  rendusAujourdhui: number;
  // Délai moyen en heures (null si aucun résultat sur la période).
  delaiMoyenHeures: number | null;
}

export async function computeRequestSummary(categoryFilter: string): Promise<RequestSummary> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const [pending, today, recent] = await Promise.all([
    hapiClient.get<FhirBundle>(`/ServiceRequest?status=active&${categoryFilter}&_summary=count`, noCache),
    hapiClient.get<FhirBundle>(`/DiagnosticReport?${categoryFilter}&issued=ge${startOfDay}&_summary=count`, noCache),
    hapiClient.get<FhirBundle>(
      `/DiagnosticReport?${categoryFilter}&issued=ge${since}&_include=DiagnosticReport:based-on&_count=200`,
      noCache,
    ),
  ]);

  const resources = (recent.entry ?? []).map((entry) => entry.resource);
  const requests = new Map(
    resources.filter((r) => r.resourceType === "ServiceRequest").map((r) => [`ServiceRequest/${r.id}`, r.authoredOn]),
  );
  const delays = resources
    .filter((r) => r.resourceType === "DiagnosticReport" && r.issued)
    .map((report) => {
      const authoredOn = requests.get(report.basedOn?.[0]?.reference ?? "");
      return authoredOn ? (new Date(report.issued!).getTime() - new Date(authoredOn).getTime()) / 3_600_000 : null;
    })
    .filter((hours): hours is number => hours !== null && hours >= 0);

  return {
    enAttente: pending.total ?? 0,
    rendusAujourdhui: today.total ?? 0,
    delaiMoyenHeures: delays.length > 0 ? Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10 : null,
  };
}
