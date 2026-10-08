import { useCallback, useEffect, useState } from "react";
import { Activity, Database, RefreshCcw, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApiError, getFhirLog, getHealth, getStats } from "../lib/api";
import type { FhirLogEntry, HealthStatus, Stats } from "../lib/types";
import { cn } from "../lib/utils";

function StatusCard({ label, ok, detail, icon: Icon }: { label: string; ok: boolean | null; detail: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-4 rounded-[18px] border border-zinc-200/70 bg-white p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1A6FD4]/10 text-[#1A6FD4]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="text-sm text-zinc-900">{detail}</p>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs",
          ok === null ? "bg-zinc-100 text-zinc-500" : ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
        )}
      >
        {ok === null ? "…" : ok ? "Opérationnel" : "Hors service"}
      </span>
    </div>
  );
}

// Accueil de l'administrateur technique : état des services du LAN, volumes de
// ressources FHIR et dernières ressources émises (routes /api/health, /api/stats
// et /api/fhir-log, déjà ouvertes à ce rôle).
export default function Supervision() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<FhirLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getHealth()
      .then((data) => {
        setHealth(data);
        setHealthError(false);
      })
      .catch(() => setHealthError(true));
    Promise.all([getStats(), getFhirLog()])
      .then(([statsData, logData]) => {
        setStats(statsData);
        setRecent(
          [...logData.resources]
            .sort((a, b) => (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? ""))
            .slice(0, 8),
        );
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable."));
  }, []);

  useEffect(load, [load]);

  const volumes = stats
    ? [
        { label: "Patients", value: stats.patients.total },
        { label: "Consultations", value: stats.consultations.total },
        { label: "Demandes d'examen", value: stats.examens.demandes },
        { label: "Résultats", value: stats.examens.resultats },
        { label: "Vaccinations", value: stats.vaccinations.total },
        { label: "Prescriptions", value: stats.prescriptions.total },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">Supervision</h1>
          <p className="mt-1 text-sm text-zinc-500">État des services du réseau local et activité FHIR</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
        >
          <RefreshCcw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatusCard
          label="Serveur Pédiatrix (backend)"
          icon={Server}
          ok={healthError ? false : health ? health.backend.status === "ok" : null}
          detail={healthError ? "Injoignable depuis ce poste" : "API REST du LAN"}
        />
        <StatusCard
          label="Serveur HAPI FHIR"
          icon={Database}
          ok={healthError ? false : health ? health.hapi.status === "up" : null}
          detail={health?.hapi.fhirVersion ? `FHIR ${health.hapi.fhirVersion}` : "Version inconnue"}
        />
      </div>

      <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
        <h2 className="text-lg text-zinc-500">Volumes de ressources</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {volumes.map((volume) => (
            <div key={volume.label} className="rounded-xl bg-[#F4F7FB] p-4">
              <p className="text-2xl font-medium text-zinc-900">{volume.value}</p>
              <p className="mt-1 text-xs text-zinc-500">{volume.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg text-zinc-500">
          <Activity className="h-5 w-5 text-[#1A6FD4]" /> Dernières ressources émises
        </h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-3 font-normal">Type</th>
              <th className="py-3 font-normal">Identifiant</th>
              <th className="py-3 font-normal">Mise à jour</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {recent.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-zinc-400">
                  Aucune ressource émise pour le moment.
                </td>
              </tr>
            )}
            {recent.map((entry) => (
              <tr key={`${entry.type}/${entry.id}`}>
                <td className="py-3 text-zinc-900">{entry.type}</td>
                <td className="py-3 text-zinc-700">{entry.id}</td>
                <td className="py-3 text-zinc-700">
                  {entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleString("fr-FR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
