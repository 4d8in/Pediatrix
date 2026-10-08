import { useEffect, useState } from "react";
import { BarChart3, Bed, Clock, TrendingUp, Info, LockKeyhole, RefreshCw, Users, FlaskConical, Syringe, Pill } from "lucide-react";
import { cn } from "../lib/utils";
import { ApiError, getStats } from "../lib/api";
import type { Stats as StatsData, UnavailableIndicator, AvailableIndicator } from "../lib/types";

function isRestrictedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

function UnavailableCard({
  label,
  icon: Icon,
  indicator,
}: {
  label: string;
  icon: typeof BarChart3;
  indicator: UnavailableIndicator | AvailableIndicator;
}) {
  if (indicator.disponible) {
    return (
      <div className="relative overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white p-8">
        <div className="mb-6 flex items-start justify-between">
          <div className="rounded-xl bg-[#1A6FD4]/10 p-3 text-[#1A6FD4]">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-sm text-zinc-500">{label}</span>
          <p className="text-3xl font-medium text-zinc-900">{indicator.valeur}</p>
          <p className="pt-2 text-xs leading-relaxed text-zinc-500">{indicator.detail}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-zinc-200/70 p-8 group hover:border-[#1A6FD4] transition-all relative overflow-hidden rounded-[18px]">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-zinc-100 text-zinc-400">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-sm font-medium text-zinc-400">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-medium text-zinc-300">—</span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed pt-2">
          Non disponible — {indicator.raison}
        </p>
      </div>
    </div>
  );
}

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restricted, setRestricted] = useState(false);

  function load() {
    setIsLoading(true);
    setError(null);
    setRestricted(false);
    getStats()
      .then((data) => setStats(data))
      .catch((err) => {
        if (isRestrictedError(err)) {
          setRestricted(true);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Erreur de chargement des statistiques.");
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (restricted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-zinc-100 border-2 border-zinc-200 rounded-full flex items-center justify-center mb-8">
            <LockKeyhole className="w-8 h-8 text-zinc-400" />
          </div>
          <h1 className="text-xl font-medium text-zinc-900 mb-4">Accès restreint</h1>
          <p className="text-xs font-medium text-zinc-500 text-center max-w-sm leading-relaxed">
            Statistiques du service — accès réservé au Directeur (et à l'Administrateur technique).
          </p>
          <div className="mt-12 h-px w-24 bg-zinc-200"></div>
        </div>
      </div>
    );
  }

  const examensParTypeSorted = stats ? Object.entries(stats.examens.parType).sort((a, b) => b[1] - a[1]) : [];
  const maxExamenCount = examensParTypeSorted.length > 0 ? examensParTypeSorted[0][1] : 0;

  return (
    <div className="space-y-6 font-sans">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-4">
          <h1 className="text-[22px] font-medium text-zinc-900">Statistiques du service</h1>
          <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 w-fit flex items-center gap-2 rounded-full">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">
              Calculées en direct depuis HAPI (local, hors ligne) — Service Pédiatrie
            </span>
          </div>
        </div>

        <button
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4] disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> Actualiser
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 p-4 text-sm font-medium text-red-700 rounded-[18px]">{error}</div>}

      {isLoading && !stats && (
        <p className="text-sm text-zinc-400">Chargement des statistiques...</p>
      )}

      {stats && (
        <>
          {/* Cartes d'indicateurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white border border-zinc-200/70 p-8 group hover:border-[#1A6FD4] transition-all relative overflow-hidden rounded-[18px]">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium text-zinc-400">Consultations ce mois</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-medium text-zinc-900">{stats.consultations.moisCourant}</span>
                  <span className="text-xs text-zinc-400">
                    {stats.consultations.total} au total
                  </span>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-100">
                <div className="h-full bg-blue-600" style={{ width: "100%" }}></div>
              </div>
            </div>

            <UnavailableCard label="Taux d'hospitalisation" icon={Bed} indicator={stats.tauxHospitalisation} />
            <UnavailableCard label="Durée moyenne de séjour" icon={Clock} indicator={stats.dureeMoyenneSejour} />
            <UnavailableCard label="Lits occupés" icon={TrendingUp} indicator={stats.litsOccupes} />
          </div>

          {/* Autres compteurs réels renvoyés par /api/stats, non repris dans les 4
              cartes ci-dessus (fidèles à la maquette) : affichés plutôt que
              calculés puis jetés. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: "Patients", value: stats.patients.total, icon: Users },
              { label: "Demandes d'examen", value: stats.examens.demandes, icon: FlaskConical },
              { label: "Résultats reçus", value: stats.examens.resultats, icon: FlaskConical },
              { label: "Vaccinations", value: stats.vaccinations.total, icon: Syringe },
            ].map((chip) => (
              <div key={chip.label} className="bg-white border border-zinc-200/70 px-6 py-5 flex items-center gap-4 rounded-[18px]">
                <chip.icon className="w-4 h-4 text-zinc-400 shrink-0" />
                <div>
                  <p className="text-lg font-medium text-zinc-900 leading-none">{chip.value}</p>
                  <p className="text-xs text-zinc-400 mt-1">{chip.label}</p>
                </div>
              </div>
            ))}
            <div className="bg-white border border-zinc-200/70 px-6 py-5 flex items-center gap-4 col-span-2 sm:col-span-1 rounded-[18px]">
              <Pill className="w-4 h-4 text-zinc-400 shrink-0" />
              <div>
                <p className="text-lg font-medium text-zinc-900 leading-none">{stats.prescriptions.total}</p>
                <p className="text-xs text-zinc-400 mt-1">Prescriptions</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            {/* Répartition des examens par type — remplace "Top pathologies" de la
                maquette : aucune ressource ne code de diagnostic dans ce socle,
                donc on affiche une donnée réelle équivalente plutôt qu'inventer
                une répartition par pathologie. */}
            <div className="bg-white border border-zinc-200/70 p-8 rounded-[18px]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-medium text-zinc-900 flex items-center gap-3">
                  Répartition des examens par type
                </h3>
              </div>

              {examensParTypeSorted.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  Aucune demande d'examen enregistrée.
                </p>
              ) : (
                <div className="space-y-5">
                  {examensParTypeSorted.map(([label, count]) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm font-medium text-zinc-900">
                        <span>{label}</span>
                        <span className="text-zinc-500">{count}</span>
                      </div>
                      <div className="h-3 bg-zinc-100 w-full overflow-hidden">
                        <div
                          className="h-full bg-[#1A6FD4]"
                          style={{ width: `${maxExamenCount > 0 ? (count / maxExamenCount) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Charge de travail par praticien : non calculable honnêtement avec
                ce socle (pas de lien Encounter -> Practitioner structuré),
                signalé comme tel plutôt qu'inventé. */}
            <div className="bg-white border border-zinc-200/70 flex flex-col rounded-[18px]">
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-900 flex items-center gap-3">
                  Charge de travail par praticien
                </h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
                <LockKeyhole className="w-8 h-8 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-400 max-w-xs leading-relaxed">
                  Non disponible — {stats.chargeParPraticien.raison}
                </p>
              </div>
              <div className="p-6 bg-white border-t border-zinc-100 flex items-center gap-3 text-zinc-400 rounded-[18px]">
                <Info className="w-3.5 h-3.5" />
                <p className="text-xs">
                  Généré le {new Date(stats.genereLe).toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      <ServiceActivity stats={stats} />
    </div>
  );
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

// Activité par service (vue Directeur) : volumes mensuels de l'année et
// occupation actuelle des lits par service.
function ServiceActivity({ stats }: { stats: StatsData | null }) {
  if (!stats) return null;
  const rows = [
    { label: "Consultations (Pédiatrie)", values: stats.activiteMensuelle.consultations },
    { label: "Examens de laboratoire", values: stats.activiteMensuelle.examensLabo },
    { label: "Examens d'imagerie", values: stats.activiteMensuelle.examensImagerie },
    { label: "Hospitalisations", values: stats.activiteMensuelle.hospitalisations },
  ];
  const currentMonth = new Date().getMonth();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
      <section className="overflow-x-auto rounded-[18px] border border-zinc-200/70 bg-white p-5">
        <h2 className="text-lg text-zinc-500">Activité par service — {new Date().getFullYear()}</h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 text-left font-normal">Activité</th>
              {MONTHS.map((month) => (
                <th key={month} className="px-1 py-2 text-right font-normal">
                  {month}
                </th>
              ))}
              <th className="py-2 pl-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-2.5 text-zinc-900">{row.label}</td>
                {row.values.map((value, month) => (
                  <td
                    key={month}
                    className={cn("px-1 py-2.5 text-right", month > currentMonth ? "text-zinc-300" : "text-zinc-700")}
                  >
                    {value}
                  </td>
                ))}
                <td className="py-2.5 pl-2 text-right font-medium text-zinc-900">
                  {row.values.reduce((sum, value) => sum + value, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
        <h2 className="text-lg text-zinc-500">Occupation des lits par service</h2>
        {stats.occupationParService.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">Aucun lit configuré.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {stats.occupationParService.map((ward) => {
              const rate = ward.total > 0 ? Math.round((ward.occupes / ward.total) * 100) : 0;
              return (
                <li key={ward.service} className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-900">{ward.service}</span>
                    <span className="text-zinc-500">
                      {ward.occupes} / {ward.total} · {rate} %
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div className="h-2 rounded-full bg-[#1A6FD4]" style={{ width: `${rate}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
