import { useEffect, useState } from "react";
import { Activity, BedDouble, ListOrdered, Syringe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApiError, getActiveQueue, getDashboardCounters, getDashboardOverview, listBeds } from "../lib/api";
import type { DashboardCounters, DashboardOverview, QueueEntry, Ward } from "../lib/types";

interface NurseDashboardProps {
  onOpenRecord: (patientId: string) => void;
  onOpenBeds: () => void;
  onOpenQueue: () => void;
}

function Tile({ label, value, icon: Icon, caption }: { label: string; value: number | undefined; icon: LucideIcon; caption: string }) {
  return (
    <div className="rounded-[18px] border border-zinc-200/70 bg-white p-4">
      <div className="flex items-start justify-between">
        <p className="text-lg text-zinc-500">{label}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-[#1A6FD4]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-[26px] font-medium text-zinc-900">{value ?? "…"}</p>
      <p className="mt-1 text-xs text-zinc-500">{caption}</p>
    </div>
  );
}

function since(date: string | null): string {
  if (!date) return "—";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  return days < 1 ? "Aujourd'hui" : `J${days}`;
}

// Accueil de l'infirmière : soins du jour (patients hospitalisés, file d'attente,
// paramètres vitaux à prendre, vaccinations). Aucune donnée inventée.
export default function NurseDashboard({ onOpenRecord, onOpenBeds, onOpenQueue }: NurseDashboardProps) {
  const [wards, setWards] = useState<Ward[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [counters, setCounters] = useState<DashboardCounters | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable.");
    listBeds().then((data) => setWards(data.wards)).catch(fail);
    getActiveQueue().then((data) => setQueue(data.queue)).catch(fail);
    getDashboardCounters().then(setCounters).catch(fail);
    getDashboardOverview().then(setOverview).catch(fail);
  }, []);

  const hospitalised = wards.flatMap((ward) =>
    ward.beds.filter((bed) => bed.stay).map((bed) => ({ ...bed.stay!, bed: bed.name, ward: ward.name })),
  );
  const waiting = queue.filter((entry) => entry.status === "en_attente");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-medium text-zinc-900">Mes soins du jour</h1>
        <p className="mt-1 text-sm text-zinc-500">Patients hospitalisés, file d'attente et actes à réaliser</p>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label="Hospitalisés" value={overview?.hospitalisation.enCours} icon={BedDouble} caption="Séjours en cours" />
        <Tile label="En attente" value={waiting.length} icon={ListOrdered} caption="Patients admis aujourd'hui, non vus" />
        <Tile
          label="Vitaux à prendre"
          value={counters?.parametresVitauxAPrendre}
          icon={Activity}
          caption="Consultations du jour sans paramètres vitaux"
        />
        <Tile
          label="Vaccins du jour"
          value={overview?.vaccinations.last7Days[6]}
          icon={Syringe}
          caption="Vaccinations enregistrées aujourd'hui"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-zinc-500">Patients hospitalisés</h2>
            <button onClick={onOpenBeds} className="text-sm text-[#1A6FD4] hover:underline">
              Gestion des lits →
            </button>
          </div>
          <ul className="mt-3 divide-y divide-zinc-100">
            {hospitalised.length === 0 && <li className="py-8 text-center text-sm text-zinc-400">Aucun patient hospitalisé.</li>}
            {hospitalised.map((stay) => (
              <li key={stay.stayId} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-zinc-900">{stay.patientName}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {stay.ward} · lit {stay.bed} · {since(stay.since)}
                    {stay.reason ? ` · ${stay.reason}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onOpenRecord(stay.patientId)}
                  className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
                >
                  Dossier
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-zinc-500">En attente de consultation</h2>
            <button onClick={onOpenQueue} className="text-sm text-[#1A6FD4] hover:underline">
              File active →
            </button>
          </div>
          <ul className="mt-3 divide-y divide-zinc-100">
            {waiting.length === 0 && <li className="py-8 text-center text-sm text-zinc-400">Personne en attente.</li>}
            {waiting.map((entry) => (
              <li key={entry.patientId} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="text-zinc-900">{entry.name}</p>
                  <p className="text-xs text-zinc-500">
                    Arrivé à{" "}
                    {entry.admittedAt
                      ? new Date(entry.admittedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </div>
                <button
                  onClick={() => onOpenRecord(entry.patientId)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
                >
                  Dossier
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
