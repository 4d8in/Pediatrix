import { useEffect, useState } from "react";
import { BedDouble, CalendarCheck, ChevronRight, FlaskConical, Info, MoreVertical, Plus, Syringe, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/auth-context";
import RecentResults from "../components/RecentResults";
import { ApiError, getDashboardOverview, listPatients } from "../lib/api";
import type { DashboardOverview, Patient } from "../lib/types";
import { CHART_COLORS, MiniBars, MonthlyBars, Pie, SegmentGauge, Sparkline } from "../components/charts";

interface DashboardProps {
  search: string;
  onOpenRecord: (patientId: string) => void;
  onOpenConsultation?: (patientId: string) => void;
}

const AVATAR_COLORS = ["bg-[#1A6FD4]", "bg-[#0B2A4F]", "bg-sky-500", "bg-indigo-500", "bg-blue-400"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Avatar local (initiales générées) : aucune image distante, offline-first.
function PatientAvatar({ name }: { name: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        colorFor(name),
      )}
    >
      {initialsOf(name)}
    </div>
  );
}

function computeAge(birthDate: string): string {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 1) return `${Math.max(months, 0)} mois`;
  return `${years} ans`;
}

const GENDER_LABELS: Record<Patient["gender"], string> = {
  male: "Masculin",
  female: "Féminin",
  other: "Autre",
  unknown: "Non renseigné",
};

function formatDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("fr-FR");
}

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

function Card({ title, children, className, action }: CardProps) {
  return (
    <section className={cn("rounded-[18px] border border-zinc-200/70 bg-white p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-zinc-500">{title}</h2>
        {action ?? <MoreVertical className="h-5 w-5 text-zinc-700" aria-hidden />}
      </div>
      {children}
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  caption: string;
  chart: React.ReactNode;
}

function StatCard({ label, value, icon: Icon, caption, chart }: StatCardProps) {
  return (
    <div className="rounded-[18px] border border-zinc-200/70 bg-white p-4">
      <div className="flex items-start justify-between">
        <p className="flex items-center gap-2 text-lg text-zinc-500">
          {label} <Info className="h-4 w-4 text-zinc-400" />
        </p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-[#1A6FD4]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[26px] font-medium text-zinc-900">{value ?? "…"}</p>
        {chart}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{caption}</p>
    </div>
  );
}

function sum(values: number[] | undefined): number {
  return (values ?? []).reduce((total, value) => total + value, 0);
}

function percent(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)} %` : "—";
}

export default function Dashboard({ search, onOpenRecord, onOpenConsultation }: DashboardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const { user } = useAuth();
  const [breakdown, setBreakdown] = useState<"sexe" | "age">("sexe");

  // Indicateurs et graphiques, tous calculés par le backend (GET /api/dashboard/overview).
  useEffect(() => {
    let cancelled = false;
    getDashboardOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Liste des patients (backend réel uniquement), filtrée par la recherche de l'en-tête.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      listPatients(search.trim() || undefined)
        .then((data) => {
          if (cancelled) return;
          setLoadError(null);
          setPatients(data.patients);
        })
        .catch((err) => {
          if (cancelled) return;
          setLoadError(err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable.");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const lab = overview?.laboratoire;
  const labTotal = (lab?.termines ?? 0) + (lab?.enAttente ?? 0);
  const sexes = overview?.sexes;
  const ageGroups = overview?.patients.parTrancheAge ?? [0, 0, 0, 0];
  const breakdownSlices =
    breakdown === "sexe"
      ? [
          { label: "Féminin", value: sexes?.feminin ?? 0, color: CHART_COLORS.dark },
          { label: "Masculin", value: sexes?.masculin ?? 0, color: "#5AA2F0" },
          { label: "Autre / non renseigné", value: sexes?.autre ?? 0, color: "#D4D4D8" },
        ]
      : [
          { label: "Moins de 1 an", value: ageGroups[0], color: "#0B2A4F" },
          { label: "1 à 4 ans", value: ageGroups[1], color: CHART_COLORS.dark },
          { label: "5 à 9 ans", value: ageGroups[2], color: "#5AA2F0" },
          { label: "10 ans et plus", value: ageGroups[3], color: CHART_COLORS.light },
        ];
  const breakdownTotal = breakdownSlices.reduce((total, slice) => total + slice.value, 0);

  return (
    <div className="space-y-4">
      <div className="pb-2">
        <h1 className="text-[22px] font-medium text-zinc-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-zinc-500">Vue d'ensemble de l'activité du service</p>
      </div>
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Consultations"
          value={overview?.consultations.total}
          icon={CalendarCheck}
          chart={<Sparkline values={overview?.consultations.last7Days ?? [0, 0]} />}
          caption={`${sum(overview?.consultations.last7Days)} consultation(s) ces 7 derniers jours`}
        />
        <StatCard
          label="Examens"
          value={overview?.examens.total}
          icon={FlaskConical}
          chart={<MiniBars values={overview?.examens.last7Days ?? []} />}
          caption={`${lab?.enAttente ?? 0} examen(s) en attente au laboratoire`}
        />
        <StatCard
          label="Patients"
          value={overview?.patients.total}
          icon={Users}
          chart={<MiniBars values={overview?.patients.parTrancheAge ?? []} />}
          caption="Répartition : < 1 an, 1–4 ans, 5–9 ans, 10 ans et +"
        />
        <StatCard
          label="Hospitalisés"
          value={overview?.hospitalisation.enCours}
          icon={BedDouble}
          chart={
            <MiniBars
              values={[overview?.hospitalisation.litsOccupes ?? 0, Math.max((overview?.hospitalisation.litsTotal ?? 0) - (overview?.hospitalisation.litsOccupes ?? 0), 0)]}
            />
          }
          caption={
            overview && overview.hospitalisation.litsTotal > 0
              ? `${overview.hospitalisation.litsOccupes} lit(s) occupé(s) sur ${overview.hospitalisation.litsTotal}`
              : "Aucun lit configuré"
          }
        />
        <StatCard
          label="Vaccinations"
          value={overview?.vaccinations.total}
          icon={Syringe}
          chart={<MiniBars values={overview?.vaccinations.last7Days ?? []} />}
          caption={`${sum(overview?.vaccinations.last7Days)} vaccin(s) administré(s) ces 7 derniers jours`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr_0.9fr]">
        <Card title="Activité mensuelle">
          <div className="my-4 flex justify-center gap-4 text-sm text-zinc-700">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full" style={{ backgroundColor: CHART_COLORS.dark }} /> Consultations
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full" style={{ backgroundColor: CHART_COLORS.light }} /> Examens demandés
            </span>
          </div>
          <MonthlyBars
            primary={overview?.activiteMensuelle.consultations ?? new Array(12).fill(0)}
            secondary={overview?.activiteMensuelle.examens ?? new Array(12).fill(0)}
          />
        </Card>

        <Card title="Laboratoire" className="flex flex-col">
          <div className="relative mt-6 flex flex-1 justify-center">
            <SegmentGauge done={lab?.termines ?? 0} pending={lab?.enAttente ?? 0} />
            <div className="absolute bottom-3 text-center">
              <p className="text-[26px] font-medium">{labTotal}</p>
              <p className="text-sm text-[#1A6FD4]">{percent(lab?.termines ?? 0, labTotal)}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-2 text-sm text-zinc-600">
            <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-zinc-200 px-3 py-1">
              <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: CHART_COLORS.dark }} /> Terminés ·{" "}
              <b className="font-medium text-zinc-900">{lab?.termines ?? 0}</b>
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-zinc-200 px-3 py-1">
              <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: CHART_COLORS.light }} /> En attente ·{" "}
              <b className="font-medium text-zinc-900">{lab?.enAttente ?? 0}</b>
            </span>
          </div>
        </Card>

        <Card title="Examens en attente">
          <div className="mt-4 space-y-3">
            {overview && overview.examensEnAttente.length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-400">Aucun examen en attente.</p>
            )}
            {overview?.examensEnAttente.map((exam) => {
              const date = exam.demandeLe ? new Date(exam.demandeLe) : null;
              return (
                <div key={exam.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-[#1A6FD4]/10 text-[#1A6FD4]">
                    <span className="text-[10px] capitalize">
                      {date ? date.toLocaleDateString("fr-FR", { weekday: "short" }) : "—"}
                    </span>
                    <span className="text-lg leading-none">{date ? date.getDate() : "—"}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">{exam.examen}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {exam.patient}
                      {date && ` · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-zinc-700" />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {user?.role === "doctor" && <RecentResults onOpenRecord={onOpenRecord} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2.25fr_0.9fr]">
        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg text-zinc-500">Patients récents</h2>
            <button
              onClick={() => selectedId && onOpenConsultation?.(selectedId)}
              disabled={!selectedId}
              title={selectedId ? undefined : "Sélectionnez un patient dans la liste pour activer ce bouton"}
              className="flex items-center gap-2 rounded-full bg-[#1A6FD4] px-4 py-2 text-sm text-white transition hover:bg-[#155bb0] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Saisir paramètres vitaux
            </button>
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="w-10 py-3 font-normal" />
                <th className="py-3 font-normal">Nom du patient</th>
                <th className="py-3 font-normal">Âge</th>
                <th className="py-3 font-normal">Date de naissance</th>
                <th className="py-3 font-normal">Sexe</th>
                <th className="py-3 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-400">
                    Chargement des patients…
                  </td>
                </tr>
              )}
              {!isLoading && patients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-400">
                    Aucun patient pour le moment.
                  </td>
                </tr>
              )}
              {patients.map((patient) => {
                const name = `${patient.firstName} ${patient.lastName}`;
                const isSelected = selectedId === patient.id;
                return (
                  <tr
                    key={patient.id}
                    onClick={() => onOpenRecord(patient.id)}
                    className={cn("cursor-pointer transition hover:bg-[#F4F7FB]", isSelected && "bg-[#1A6FD4]/5")}
                  >
                    <td className="py-3">
                      <input
                        type="radio"
                        name="dashboard-patient"
                        aria-label={`Sélectionner ${name}`}
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => setSelectedId(patient.id)}
                        className="h-4 w-4 accent-[#1A6FD4]"
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <PatientAvatar name={name} />
                        <span className="text-zinc-900">{name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-zinc-700">{computeAge(patient.birthDate)}</td>
                    <td className="py-3 text-zinc-700">{formatDate(patient.birthDate)}</td>
                    <td className="py-3 text-zinc-700">{GENDER_LABELS[patient.gender]}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRecord(patient.id);
                        }}
                        className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-[#1A6FD4]"
                        title="Consulter le dossier"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <Card
          title="Répartition des patients"
          action={
            <select
              aria-label="Critère de répartition"
              value={breakdown}
              onChange={(event) => setBreakdown(event.target.value as "sexe" | "age")}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 outline-none focus:border-[#1A6FD4]"
            >
              <option value="sexe">Par sexe</option>
              <option value="age">Par âge</option>
            </select>
          }
        >
          <div className="mt-4 flex flex-col items-center gap-5">
            <Pie slices={breakdownSlices} />
            <ul className="w-full space-y-2 text-sm">
              {breakdownSlices.map((slice) => (
                <li key={slice.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-zinc-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    {slice.label}
                  </span>
                  <span className="text-zinc-500">
                    {slice.value} · {percent(slice.value, breakdownTotal)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
