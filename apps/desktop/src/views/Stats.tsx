import { useEffect, useState } from "react";
import { BarChart3, Bed, Clock, TrendingUp, Info, LockKeyhole, RefreshCw, Users, FlaskConical, Syringe, Pill } from "lucide-react";
import { cn } from "../lib/utils";
import { ApiError, getStats } from "../lib/api";
import type { Stats as StatsData, UnavailableIndicator } from "../lib/types";

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
  indicator: UnavailableIndicator;
}) {
  return (
    <div className="bg-white border border-zinc-200 p-8 shadow-sm group hover:border-zinc-900 transition-all relative overflow-hidden">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-zinc-100 text-zinc-400">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-zinc-300">—</span>
        </div>
        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest leading-relaxed pt-2">
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
          <div className="w-20 h-20 bg-zinc-100 border-2 border-zinc-200 rounded-full flex items-center justify-center mb-8 shadow-xl">
            <LockKeyhole className="w-8 h-8 text-zinc-400" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-[0.2em] text-zinc-900 mb-4">Accès_Restreint</h1>
          <p className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest text-center max-w-sm leading-relaxed">
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
    <div className="p-10 space-y-10 font-sans bg-zinc-50/50 min-h-full pb-20">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center text-white text-[10px] font-black">
              ST
            </div>
            <h1 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-900">Statistiques du service</h1>
          </div>
          <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 w-fit flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">
              Calculées en direct depuis HAPI (local, hors ligne) — Service Pédiatrie
            </span>
          </div>
        </div>

        <button
          onClick={load}
          disabled={isLoading}
          className="bg-white border-2 border-zinc-900 text-zinc-900 px-6 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center gap-3 shadow-[4px_4px_0px_#18181b] disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> Actualiser
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 p-4 text-[11px] font-bold text-red-700">{error}</div>}

      {isLoading && !stats && (
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Chargement des statistiques...</p>
      )}

      {stats && (
        <>
          {/* Cartes d'indicateurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white border border-zinc-200 p-8 shadow-sm group hover:border-zinc-900 transition-all relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Consultations ce mois</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tight text-zinc-900">{stats.consultations.moisCourant}</span>
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
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
              <div key={chip.label} className="bg-white border border-zinc-200 px-6 py-5 flex items-center gap-4">
                <chip.icon className="w-4 h-4 text-zinc-400 shrink-0" />
                <div>
                  <p className="text-lg font-black text-zinc-900 leading-none">{chip.value}</p>
                  <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mt-1">{chip.label}</p>
                </div>
              </div>
            ))}
            <div className="bg-white border border-zinc-200 px-6 py-5 flex items-center gap-4 col-span-2 sm:col-span-1">
              <Pill className="w-4 h-4 text-zinc-400 shrink-0" />
              <div>
                <p className="text-lg font-black text-zinc-900 leading-none">{stats.prescriptions.total}</p>
                <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mt-1">Prescriptions</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            {/* Répartition des examens par type — remplace "Top pathologies" de la
                maquette : aucune ressource ne code de diagnostic dans ce socle,
                donc on affiche une donnée réelle équivalente plutôt qu'inventer
                une répartition par pathologie. */}
            <div className="bg-white border border-zinc-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900 flex items-center gap-3">
                  <span className="w-8 h-px bg-zinc-900"></span>
                  Répartition des examens par type
                </h3>
              </div>

              {examensParTypeSorted.length === 0 ? (
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                  Aucune demande d'examen enregistrée.
                </p>
              ) : (
                <div className="space-y-5">
                  {examensParTypeSorted.map(([label, count]) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-900">
                        <span>{label}</span>
                        <span className="font-mono text-zinc-500">{count}</span>
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
            <div className="bg-white border border-zinc-200 shadow-sm flex flex-col">
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900 flex items-center gap-3">
                  <span className="w-8 h-px bg-zinc-900"></span>
                  Charge de travail par praticien
                </h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
                <LockKeyhole className="w-8 h-8 text-zinc-300" />
                <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest max-w-xs leading-relaxed">
                  Non disponible — {stats.chargeParPraticien.raison}
                </p>
              </div>
              <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex items-center gap-3 text-zinc-400">
                <Info className="w-3.5 h-3.5" />
                <p className="text-[9px] font-mono uppercase tracking-widest italic">
                  Généré le {new Date(stats.genereLe).toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
