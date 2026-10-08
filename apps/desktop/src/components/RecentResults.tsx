import { useEffect, useState } from "react";
import { FlaskConical, ScanLine } from "lucide-react";
import { ApiError, getRecentResults, markResultRead } from "../lib/api";
import type { RecentResult } from "../lib/types";
import { cn } from "../lib/utils";

// Résultats reçus ces 7 derniers jours (labo et imagerie) pour le médecin, avec
// les non lus mis en avant. Ouvrir un résultat le marque comme lu.
export default function RecentResults({ onOpenRecord }: { onOpenRecord: (patientId: string) => void }) {
  const [results, setResults] = useState<RecentResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecentResults()
      .then((data) => setResults(data.results))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable."));
  }, []);

  const unread = results.filter((result) => !result.read).length;

  function open(result: RecentResult) {
    if (!result.read) {
      setResults((prev) => prev.map((r) => (r.id === result.id ? { ...r, read: true } : r)));
      markResultRead(result.id).catch(() => undefined);
    }
    onOpenRecord(result.patientId);
  }

  return (
    <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg text-zinc-500">
          Résultats reçus
          {unread > 0 && (
            <span className="rounded-full bg-[#1A6FD4] px-2 py-0.5 text-xs font-medium text-white">{unread} non lu(s)</span>
          )}
        </h2>
        <span className="text-xs text-zinc-400">7 derniers jours</span>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-3 divide-y divide-zinc-100">
        {results.length === 0 && !error && <li className="py-8 text-center text-sm text-zinc-400">Aucun résultat reçu.</li>}
        {results.map((result) => (
          <li key={result.id}>
            <button
              onClick={() => open(result)}
              className="flex w-full items-center gap-3 py-3 text-left text-sm transition hover:bg-[#F4F7FB]"
            >
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", result.read ? "bg-transparent" : "bg-[#1A6FD4]")}
                aria-label={result.read ? undefined : "Non lu"}
              />
              {result.kind === "imagerie" ? (
                <ScanLine className="h-4 w-4 shrink-0 text-zinc-400" />
              ) : (
                <FlaskConical className="h-4 w-4 shrink-0 text-zinc-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate", result.read ? "text-zinc-700" : "font-medium text-zinc-900")}>
                  {result.exam} — {result.patientName}
                </p>
                {result.conclusion && <p className="truncate text-xs text-zinc-500">{result.conclusion}</p>}
              </div>
              <span className="shrink-0 text-xs text-zinc-400">
                {result.issued
                  ? new Date(result.issued).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
