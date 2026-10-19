import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { ApiError, listAudit } from "../lib/api";
import type { AuditEntry } from "../lib/types";

const ACTION_LABELS: Record<string, string> = {
  C: "Création",
  R: "Lecture",
  U: "Modification",
  D: "Suppression",
  E: "Exécution",
};

// Journal d'audit : qui a fait quoi, quand, sur quel dossier (direction et administration).
export default function AuditLog() {
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [patientId, setPatientId] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    listAudit(filter || undefined)
      .then((data) => setEvents(data.events))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erreur de chargement du journal."))
      .finally(() => setIsLoading(false));
  }, [filter]);

  useEffect(load, [load]);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    setFilter(patientId.trim());
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-medium text-zinc-900">
            <ShieldCheck className="h-5 w-5 text-[#1A6FD4]" /> Journal d'audit
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Accès aux dossiers, modifications, connexions et refus de droits</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      <form onSubmit={handleFilter} className="flex items-center gap-3">
        <input
          value={patientId}
          onChange={(event) => setPatientId(event.target.value)}
          placeholder="Filtrer par identifiant de dossier patient"
          data-testid="audit-patient-filter"
          className="w-80 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-[#1A6FD4]"
        />
        <button type="submit" className="rounded-full bg-[#1A6FD4] px-5 py-2 text-xs font-medium text-white hover:bg-[#155bb0]">
          Filtrer
        </button>
        {filter && (
          <button
            type="button"
            onClick={() => {
              setPatientId("");
              setFilter("");
            }}
            className="text-xs text-zinc-500 hover:underline"
          >
            Effacer
          </button>
        )}
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-auto rounded-[18px] border border-zinc-200/70 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 text-xs text-zinc-400">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Utilisateur</th>
              <th className="px-3 py-3 font-medium">Action</th>
              <th className="px-3 py-3 font-medium">Dossier</th>
              <th className="px-3 py-3 font-medium">Détail</th>
              <th className="px-3 py-3 font-medium">Résultat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-zinc-400">
                  Aucun événement.
                </td>
              </tr>
            )}
            {events.map((event) => (
              <tr key={event.id}>
                <td className="whitespace-nowrap px-5 py-3 text-zinc-500">
                  {event.recorded ? new Date(event.recorded).toLocaleString("fr-FR") : "—"}
                </td>
                <td className="px-3 py-3 text-zinc-900">
                  {event.who}
                  {event.role && <span className="ml-2 text-xs text-zinc-400">{event.role}</span>}
                </td>
                <td className="px-3 py-3 text-zinc-700">{event.login ? "Connexion" : (ACTION_LABELS[event.action] ?? event.action)}</td>
                <td className="px-3 py-3 text-zinc-500">{event.patientId ?? "—"}</td>
                <td className="px-3 py-3 text-xs text-zinc-500">{event.description}</td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-medium ${event.success ? "text-green-700" : "text-red-700"}`}>
                    {event.success ? "Réussi" : "Refusé"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
