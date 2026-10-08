import { useEffect, useState } from "react";
import { RefreshCcw, Terminal } from "lucide-react";
import { ApiError, getFhirLog } from "../lib/api";
import type { FhirLogEntry } from "../lib/types";

const BADGE_COLORS: Record<string, string> = {
  Patient: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  Encounter: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  Observation: "bg-teal-500/10 text-teal-700 border-teal-500/30",
  ServiceRequest: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  DiagnosticReport: "bg-green-500/10 text-green-700 border-green-500/30",
  Immunization: "bg-pink-500/10 text-pink-700 border-pink-500/30",
  AllergyIntolerance: "bg-red-500/10 text-red-700 border-red-500/30",
  MedicationRequest: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
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
    <div className="flex h-full flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-medium text-zinc-900">Flux FHIR</h1>
        <p className="mt-1 text-sm text-zinc-500">Ressources FHIR réellement émises par le backend</p>
      </div>
      <div className="grid flex-1 min-h-[560px] grid-cols-[minmax(280px,35%)_1fr] gap-4">
        <section className="flex flex-col overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-100 p-5">
            <div>
              <h2 className="flex items-center gap-2 text-lg text-zinc-700">
                <Terminal className="h-5 w-5 text-[#1A6FD4]" /> Ressources émises
              </h2>
              <p className="mt-1 text-xs text-zinc-500">FHIR R4</p>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Actualiser
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {isLoading && <p className="p-3 text-sm text-zinc-500">Chargement…</p>}
            {error && <p className="p-3 text-sm text-red-600">{error}</p>}
            {!isLoading && !error && resources.length === 0 && (
              <p className="p-3 text-sm text-zinc-500">Aucune ressource émise pour le moment.</p>
            )}
            {resources.map((resource) => {
              const isSelected = selected?.id === resource.id && selected.type === resource.type;
              return (
                <button
                  key={`${resource.type}/${resource.id}`}
                  onClick={() => setSelected(resource)}
                  className={`mb-2 flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition ${
                    isSelected ? "border-[#1A6FD4] bg-[#1A6FD4]/5" : "border-zinc-200 hover:bg-[#F4F7FB]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      {resource.lastUpdated ? new Date(resource.lastUpdated).toLocaleString("fr-FR") : "—"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        BADGE_COLORS[resource.type] ?? "bg-zinc-500/10 text-zinc-600 border-zinc-500/30"
                      }`}
                    >
                      {resource.type}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-900">
                    {resource.type}/{resource.id}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white">
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b border-zinc-100 p-5 text-lg">
                <span className="text-zinc-500">Ressource JSON</span>
                <span className="text-zinc-300">/</span>
                <span className="text-[#1A6FD4]">
                  {selected.type}/{selected.id}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <pre className="overflow-x-auto rounded-xl bg-[#0B2A4F] p-6 font-mono text-xs leading-relaxed text-blue-50">
                  {JSON.stringify(selected.json, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-400">Sélectionnez une ressource pour afficher son JSON</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
