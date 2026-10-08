import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import { IMAGING_CATEGORY_SEARCH_TOKEN } from "../lib/service-category.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";
import { computeHospitalisationStats } from "../lib/hospitalisation-stats.js";

// Données agrégées du tableau de bord (cartes, graphiques, examens en attente).
// Tout est calculé à partir des ressources FHIR réellement présentes dans HAPI :
// aucune valeur n'est inventée. Même motif de pagination que
// dashboard-counters.route.ts, dupliqué localement pour garder la route isolée.

interface FhirBundlePage<T> {
  entry?: { resource: T }[];
  link?: { relation?: string; url?: string }[];
}

interface FhirResource {
  resourceType: string;
  id: string;
  gender?: string;
  birthDate?: string;
  name?: { family?: string; given?: string[] }[];
  period?: { start?: string };
  authoredOn?: string;
  occurrenceDateTime?: string;
  status?: string;
  code?: { text?: string };
  subject?: { reference?: string };
}

async function fetchAll(path: string): Promise<FhirResource[]> {
  const resources: FhirResource[] = [];
  let bundle = await hapiClient.get<FhirBundlePage<FhirResource>>(path, { "Cache-Control": "no-cache" });

  while (true) {
    resources.push(...(bundle.entry ?? []).map((entry) => entry.resource));

    const nextUrl = bundle.link?.find((link) => link.relation === "next")?.url;
    if (!nextUrl) break;

    const response = await fetch(nextUrl, {
      headers: { Accept: "application/fhir+json", "Cache-Control": "no-cache" },
    });
    if (!response.ok) {
      throw new HapiError(response.status, `HAPI a répondu ${response.status} lors de la pagination.`);
    }
    bundle = (await response.json()) as FhirBundlePage<FhirResource>;
  }

  return resources;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Nombre d'éléments par jour sur les 7 derniers jours (du plus ancien au plus récent).
function lastSevenDays(dates: (string | undefined)[], now: Date): number[] {
  const startOfDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const today = startOfDay(now);
  const counts = new Array<number>(7).fill(0);
  for (const date of dates) {
    if (!date) continue;
    const daysAgo = Math.round((today - startOfDay(new Date(date))) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 7) counts[6 - daysAgo] += 1;
  }
  return counts;
}

// Nombre d'éléments par mois de l'année civile en cours (janvier → décembre).
function perMonthThisYear(dates: (string | undefined)[], now: Date): number[] {
  const counts = new Array<number>(12).fill(0);
  for (const date of dates) {
    if (!date) continue;
    const parsed = new Date(date);
    if (parsed.getUTCFullYear() === now.getUTCFullYear()) counts[parsed.getUTCMonth()] += 1;
  }
  return counts;
}

function ageInYears(birthDate: string | undefined, now: Date): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

function patientName(patient: FhirResource | undefined): string {
  const name = patient?.name?.[0];
  return [name?.given?.[0], name?.family].filter(Boolean).join(" ") || "Patient inconnu";
}

export async function dashboardOverviewRoute(app: FastifyInstance) {
  app.get(
    "/api/dashboard/overview",
    { preHandler: [authenticate, authorize("nurse", "doctor", "director")] },
    async (_request, reply) => {
      try {
        const now = new Date();
        const labFilter = `category:not=${IMAGING_CATEGORY_SEARCH_TOKEN}`;

        const [patients, encounters, labRequests, labReports, immunizations, hospitalisation] = await Promise.all([
          fetchAll("/Patient?_elements=gender,birthDate&_count=200"),
          fetchAll("/Encounter?class=AMB&_elements=period&_count=200"),
          fetchAll(`/ServiceRequest?${labFilter}&_elements=status,authoredOn,code,subject&_count=200`),
          fetchAll(`/DiagnosticReport?${labFilter}&_elements=status&_count=200`),
          fetchAll("/Immunization?_elements=occurrenceDateTime&_count=200"),
          computeHospitalisationStats(),
        ]);

        const pendingLab = labRequests
          .filter((request) => request.status === "active")
          .sort((a, b) => (b.authoredOn ?? "").localeCompare(a.authoredOn ?? ""));

        // Noms des patients des 3 dernières demandes en attente (lecture par id).
        const latestPending = pendingLab.slice(0, 3);
        const pendingPatients = await Promise.all(
          latestPending.map((request) => {
            const reference = request.subject?.reference;
            return reference
              ? hapiClient.get<FhirResource>(`/${reference}`).catch(() => undefined)
              : Promise.resolve(undefined);
          }),
        );

        const ageGroups = [0, 0, 0, 0];
        for (const patient of patients) {
          const age = ageInYears(patient.birthDate, now);
          if (age === null) continue;
          if (age < 1) ageGroups[0] += 1;
          else if (age < 5) ageGroups[1] += 1;
          else if (age < 10) ageGroups[2] += 1;
          else ageGroups[3] += 1;
        }

        const encounterDates = encounters.map((encounter) => encounter.period?.start);
        const labRequestDates = labRequests.map((request) => request.authoredOn);
        const immunizationDates = immunizations.map((immunization) => immunization.occurrenceDateTime);

        return reply.send({
          consultations: { total: encounters.length, last7Days: lastSevenDays(encounterDates, now) },
          examens: { total: labRequests.length, last7Days: lastSevenDays(labRequestDates, now) },
          patients: { total: patients.length, parTrancheAge: ageGroups },
          vaccinations: { total: immunizations.length, last7Days: lastSevenDays(immunizationDates, now) },
          activiteMensuelle: {
            consultations: perMonthThisYear(encounterDates, now),
            examens: perMonthThisYear(labRequestDates, now),
          },
          hospitalisation: {
            enCours: hospitalisation.sejoursEnCours,
            litsOccupes: hospitalisation.litsOccupes,
            litsTotal: hospitalisation.litsTotal,
          },
          laboratoire: { termines: labReports.length, enAttente: pendingLab.length },
          examensEnAttente: latestPending.map((request, index) => ({
            id: request.id,
            examen: request.code?.text ?? "Examen",
            patient: patientName(pendingPatients[index]),
            demandeLe: request.authoredOn ?? null,
          })),
          sexes: {
            feminin: patients.filter((patient) => patient.gender === "female").length,
            masculin: patients.filter((patient) => patient.gender === "male").length,
            autre: patients.filter((patient) => patient.gender !== "female" && patient.gender !== "male").length,
          },
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
