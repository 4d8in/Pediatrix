import { useEffect, useState } from "react";
import { RefreshCcw, Terminal } from "lucide-react";
import { ApiError, getFhirLog } from "../lib/api";
import type { FhirLogEntry } from "../lib/types";

const BADGE_COLORS: Record<string, string> = {
  Patient: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  Encounter: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  Observation: "bg-teal-500/10 text-teal-400 border-teal-500/30",
  ServiceRequest: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  DiagnosticReport: "bg-green-500/10 text-green-400 border-green-500/30",
};

export default function FhirLog() {
  const [resources, setResources] = useState<FhirLogEntry[]>([]);
  const [selected, setSelected] = useState<FhirLogEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setError(null);
    getFhirLog()
      .then((data) => {
        setResources(data.resources);
        setSelected((current) => current ?? data.resources[0] ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erreur de chargement du flux FHIR."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white font-sans">
      <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-green-500" />
            <h1 className="text-sm font-black uppercase tracking-[0.3em]">Flux FHIR</h1>
          </div>
          <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
            Ressources réellement émises par le backend — FHIR R4
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          <RefreshCcw className="w-3 h-3" /> Actualiser
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[35%] border-r border-white/5 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <p className="p-6 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Chargement...</p>
            )}
            {error && <p className="p-6 text-[10px] font-mono text-red-400 uppercase tracking-widest">{error}</p>}
            {!isLoading && !error && resources.length === 0 && (
              <p className="p-6 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Aucune ressource émise pour le moment.
              </p>
            )}

            {resources.map((resource) => (
              <button
                key={`${resource.type}/${resource.id}`}
                onClick={() => setSelected(resource)}
                className={`w-full p-6 flex flex-col gap-3 border-b border-white/[0.02] text-left transition-all ${
                  selected?.id === resource.id && selected.type === resource.type
                    ? "bg-white/[0.04]"
                    : "hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-zinc-500">
                    {resource.lastUpdated ? new Date(resource.lastUpdated).toLocaleString("fr-FR") : "—"}
                  </span>
                  <span
                    className={`text-[8px] font-black px-2 py-0.5 border uppercase tracking-widest rounded-sm ${
                      BADGE_COLORS[resource.type] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                    }`}
                  >
                    {resource.type}
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-300">{resource.type}/{resource.id}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="p-6 border-b border-white/5 flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Resource JSON
                </span>
                <span className="text-zinc-700 text-xs">/</span>
                <span className="text-[10px] font-mono text-green-500">
                  {selected.type}/{selected.id}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-10">
                <div className="bg-zinc-900/50 border border-white/5 p-8 font-mono text-xs leading-relaxed text-zinc-300 overflow-x-auto">
                  <pre>{JSON.stringify(selected.json, null, 2)}</pre>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center opacity-30">
              <p className="text-[11px] font-black uppercase tracking-[0.3em]">Sélectionner une ressource</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
