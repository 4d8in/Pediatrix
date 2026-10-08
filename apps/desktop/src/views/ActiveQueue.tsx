import { useEffect, useState } from "react";
import { RefreshCcw, Search } from "lucide-react";
import { ApiError, getActiveQueue } from "../lib/api";
import type { QueueEntry } from "../lib/types";
import { cn } from "../lib/utils";

interface ActiveQueueProps {
  onOpenRecord: (patientId: string) => void;
  onOpenConsultation?: (patientId: string) => void;
}

type Filter = "en_attente" | "consulte" | "tous";

const STATUS_LABELS: Record<QueueEntry["status"], string> = {
  en_attente: "En attente",
  consulte: "Consulté",
};

function ageOf(birthDate: string | null): string {
  if (!birthDate) return "—";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  return months < 12 ? `${Math.max(months, 0)} mois` : `${Math.floor(months / 12)} ans`;
}

function timeOf(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// File active du jour : patients admis aujourd'hui et leur statut (GET /api/queue).
export default function ActiveQueue({ onOpenRecord, onOpenConsultation }: ActiveQueueProps) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("en_attente");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    getActiveQueue()
      .then((data) => {
        setQueue(data.queue);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable."))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  const counts = {
    en_attente: queue.filter((entry) => entry.status === "en_attente").length,
    consulte: queue.filter((entry) => entry.status === "consulte").length,
    tous: queue.length,
  };
  const query = search.trim().toLowerCase();
  const rows = queue.filter(
    (entry) => (filter === "tous" || entry.status === filter) && (!query || entry.name.toLowerCase().includes(query)),
  );

  const tabs: { id: Filter; label: string }[] = [
    { id: "en_attente", label: `En attente (${counts.en_attente})` },
    { id: "consulte", label: `Consultés (${counts.consulte})` },
    { id: "tous", label: `Tous (${counts.tous})` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">File active des patients</h1>
          <p className="mt-1 text-sm text-zinc-500">Patients admis aujourd'hui, en attente ou déjà consultés</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
        >
          <RefreshCcw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  filter === tab.id ? "bg-[#1A6FD4] text-white" : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Rechercher un patient…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-64 rounded-lg border border-zinc-200 bg-[#F4F7FB] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[#1A6FD4]"
            />
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-3 font-normal">#</th>
              <th className="py-3 font-normal">Patient</th>
              <th className="py-3 font-normal">Âge</th>
              <th className="py-3 font-normal">Motif</th>
              <th className="py-3 font-normal">Heure d'arrivée</th>
              <th className="py-3 font-normal">Statut</th>
              <th className="py-3 text-right font-normal">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-400">
                  Aucun patient dans cette liste aujourd'hui.
                </td>
              </tr>
            )}
            {rows.map((entry, index) => (
              <tr key={entry.patientId} className="transition hover:bg-[#F4F7FB]">
                <td className="py-3 text-zinc-500">{String(index + 1).padStart(3, "0")}</td>
                <td className="py-3 text-zinc-900">{entry.name}</td>
                <td className="py-3 text-zinc-700">{ageOf(entry.birthDate)}</td>
                <td className="py-3 text-zinc-700">{entry.reason ?? "—"}</td>
                <td className="py-3 text-zinc-700">{timeOf(entry.admittedAt)}</td>
                <td className="py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs",
                      entry.status === "en_attente" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {STATUS_LABELS[entry.status]}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {onOpenConsultation && entry.status === "en_attente" && (
                      <button
                        onClick={() => onOpenConsultation(entry.patientId)}
                        className="rounded-lg bg-[#1A6FD4] px-3 py-1.5 text-xs text-white transition hover:bg-[#155bb0]"
                      >
                        Consulter
                      </button>
                    )}
                    <button
                      onClick={() => onOpenRecord(entry.patientId)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
                    >
                      Voir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
