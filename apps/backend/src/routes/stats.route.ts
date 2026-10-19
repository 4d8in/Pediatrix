import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";
import { fetchAll } from "../lib/fhir-search.js";
import { computeHospitalisationStats, computeMonthlyActivity } from "../lib/hospitalisation-stats.js";
import { IMAGING_CATEGORY_CODE } from "../lib/service-category.js";

interface CountBundle {
  total?: number;
}

// Même principe que reporting/hapi-stats.ts (_summary=count, une requête par
// type, pas de whole-system search) mais délibérément dupliqué plutôt
// qu'importé : cette route doit rester totalement découplée du worker
// reporting/Supabase, qui n'est pas concerné par cette tâche (voir CLAUDE.md).
//
// Cache-Control: no-cache, même motif que GET /api/lab/requests
// (list-lab-requests.route.ts) : sans cet en-tête, HAPI peut réutiliser un
// résultat de recherche mis en cache pour ces mêmes paramètres et masquer des
// ressources tout juste créées pendant un temps variable et non borné.
async function countResource(resourceType: string, extraParams = ""): Promise<number> {
  const bundle = await hapiClient.get<CountBundle>(`/${resourceType}?_summary=count${extraParams}`, {
    "Cache-Control": "no-cache",
  });
  return bundle.total ?? 0;
}

interface FhirServiceRequestElement {
  resourceType: "ServiceRequest";
  code?: { text?: string };
}

interface FhirBundlePage {
  entry?: { resource: FhirServiceRequestElement }[];
  link?: { relation?: string; url?: string }[];
}

// ServiceRequest.code.text est du texte libre : pas de group-by HAPI possible,
// donc on pagine et on agrège en mémoire (même limite documentée que
// reporting/hapi-stats.ts::countExamensParType).
async function countExamensParType(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  let bundle = await hapiClient.get<FhirBundlePage>("/ServiceRequest?_elements=code&_count=100", {
    "Cache-Control": "no-cache",
  });

  while (true) {
    for (const entry of bundle.entry ?? []) {
      const label = entry.resource.code?.text ?? "Non précisé";
      result[label] = (result[label] ?? 0) + 1;
    }

    const nextUrl = bundle.link?.find((link) => link.relation === "next")?.url;
    if (!nextUrl) break;

    // fetch brut (pas hapiClient) car nextUrl est une URL absolue fournie par
    // HAPI ; même en-tête no-cache que ci-dessus, même raison.
    const response = await fetch(nextUrl, {
      headers: { Accept: "application/fhir+json", "Cache-Control": "no-cache" },
    });
    if (!response.ok) {
      throw new HapiError(response.status, `HAPI a répondu ${response.status} lors de la pagination des ServiceRequest.`);
    }
    bundle = (await response.json()) as FhirBundlePage;
  }

  return result;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function currentMonthRange(now: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: toDateOnly(start), end: toDateOnly(end) };
}

// Indicateurs que le socle FHIR actuel ne permet pas de calculer de façon
// fiable : pas de modèle d'admission/décharge ni de gestion des lits
// (Location) parmi les ressources produites par ce backend. Renvoyés
// explicitement comme non disponibles plutôt qu'avec une valeur inventée.
function unavailable(raison: string) {
  return { disponible: false as const, raison };
}

function available(valeur: string, detail: string) {
  return { disponible: true as const, valeur, detail };
}

// Consultations du mois par praticien (Encounter.participant). Les consultations
// antérieures au suivi des praticiens n'ont pas de participant et sont comptées à part.
export function countByPractitioner(encounters: { participant?: { individual?: { display?: string } }[] }[]) {
  const counts = new Map<string, number>();
  let sansPraticien = 0;
  for (const encounter of encounters) {
    const name = encounter.participant?.find((p) => p.individual?.display)?.individual?.display;
    if (!name) sansPraticien += 1;
    else counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const parPraticien = [...counts.entries()]
    .map(([nom, consultations]) => ({ nom, consultations }))
    .sort((a, b) => b.consultations - a.consultations || a.nom.localeCompare(b.nom));
  return { parPraticien, sansPraticien };
}

export async function statsRoute(app: FastifyInstance) {
  app.get(
    "/api/stats",
    { preHandler: [authenticate, authorize("director", "tech_admin")] },
    async (_request, reply) => {
      try {
        const { start, end } = currentMonthRange(new Date());

        const [
          nbPatients,
          nbConsultations,
          nbConsultationsMoisCourant,
          nbDemandesExamen,
          nbRapports,
          nbVaccinations,
          nbPrescriptions,
          examensParType,
        ] = await Promise.all([
          countResource("Patient"),
          countResource("Encounter", "&class=AMB&status=finished"),
          countResource("Encounter", `&class=AMB&status=finished&date=ge${start}&date=lt${end}`),
          countResource("ServiceRequest"),
          countResource("DiagnosticReport"),
          countResource("Immunization"),
          countResource("MedicationRequest"),
          countExamensParType(),
        ]);
        const [hospitalisation, activiteMensuelle, consultationsDuMois] = await Promise.all([
          computeHospitalisationStats(),
          computeMonthlyActivity(IMAGING_CATEGORY_CODE),
          fetchAll<{ participant?: { individual?: { display?: string } }[] }>(
            `/Encounter?class=AMB&status=finished&date=ge${start}&date=lt${end}`,
          ),
        ]);
        const charge = countByPractitioner(consultationsDuMois);

        return reply.send({
          genereLe: new Date().toISOString(),
          patients: { total: nbPatients },
          consultations: { total: nbConsultations, moisCourant: nbConsultationsMoisCourant },
          examens: { demandes: nbDemandesExamen, resultats: nbRapports, parType: examensParType },
          vaccinations: { total: nbVaccinations },
          prescriptions: { total: nbPrescriptions },
          activiteMensuelle,
          occupationParService: hospitalisation.parService,
          // Taux d'hospitalisation = séjours / consultations (tous deux cumulés depuis le début).
          tauxHospitalisation:
            nbConsultations > 0
              ? available(
                  `${Math.round((hospitalisation.sejoursTotal / nbConsultations) * 1000) / 10} %`,
                  `${hospitalisation.sejoursTotal} hospitalisation(s) pour ${nbConsultations} consultation(s)`,
                )
              : unavailable("Aucune consultation enregistrée : le taux ne peut pas encore être calculé."),
          dureeMoyenneSejour:
            hospitalisation.dureeMoyenneJours !== null
              ? available(`${hospitalisation.dureeMoyenneJours} j`, "Moyenne des séjours terminés")
              : unavailable("Aucun séjour terminé pour le moment."),
          litsOccupes:
            hospitalisation.litsTotal > 0
              ? available(
                  `${hospitalisation.litsOccupes} / ${hospitalisation.litsTotal}`,
                  `${Math.round((hospitalisation.litsOccupes / hospitalisation.litsTotal) * 100)} % d'occupation`,
                )
              : unavailable("Aucun lit configuré (script seed-beds.ts non lancé)."),
          chargeParPraticien:
            charge.parPraticien.length > 0
              ? {
                  ...available(
                    `${charge.parPraticien.length} praticien(s)`,
                    charge.sansPraticien > 0
                      ? `${charge.sansPraticien} consultation(s) du mois sans praticien enregistré (avant le suivi par praticien)`
                      : "Consultations du mois courant",
                  ),
                  parPraticien: charge.parPraticien,
                }
              : unavailable(
                  "Aucune consultation du mois n'est rattachée à un praticien (suivi activé récemment : la charge apparaîtra avec les prochaines consultations).",
                ),
        });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
