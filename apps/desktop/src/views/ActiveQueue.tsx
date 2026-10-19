import { Fragment, useEffect, useState } from "react";
import { RefreshCcw, Search, UserCheck } from "lucide-react";
import PatientPicker from "../components/PatientPicker";
import { ApiError, checkInPatient, getActiveQueue, markLeftWithoutConsultation, setTriage } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { Patient, QueueEntry, TriageCategory, TriageVitals } from "../lib/types";
import { cn } from "../lib/utils";
import { LOCALES, useI18n } from "../lib/i18n";

interface ActiveQueueProps {
  onOpenRecord: (patientId: string) => void;
  onOpenConsultation?: (patientId: string) => void;
}

type Filter = "en_attente" | "consulte" | "tous";

const STATUS_LABELS: Record<QueueEntry["status"], string> = {
  en_attente: "En attente",
  consulte: "Consulté",
};

const TRIAGE_STYLES: Record<TriageCategory, { label: string; className: string }> = {
  emergency: { label: "Urgence", className: "bg-red-100 text-red-700" },
  priority: { label: "Prioritaire", className: "bg-amber-100 text-amber-700" },
  non_urgent: { label: "Non urgent", className: "bg-emerald-50 text-emerald-700" },
};

function ageOf(birthDate: string | null, t: (fr: string) => string): string {
  if (!birthDate) return "—";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  return months < 12 ? `${Math.max(months, 0)} ${t("mois")}` : `${Math.floor(months / 12)} ${t("ans")}`;
}

const VITAL_FIELDS: { key: keyof TriageVitals; label: string; unit: string }[] = [
  { key: "temperature", label: "Temp.", unit: "°C" },
  { key: "heartRate", label: "FC", unit: "/min" },
  { key: "respiratoryRate", label: "FR", unit: "/min" },
  { key: "spo2", label: "SpO₂", unit: "%" },
];

// Temps d'attente depuis l'arrivée, en minutes (rouge au-delà d'une heure).
function waitOf(date: string | null, t: (fr: string, vars?: Record<string, string | number>) => string): { label: string; late: boolean } | null {
  if (!date) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  const label = minutes < 60
      ? t("{n} min", { n: minutes })
      : t("{h} h {m}", { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, "0") });
  return { label, late: minutes >= 60 };
}

function timeOf(date: string | null, locale: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

// File active du jour : patients admis aujourd'hui et leur statut (GET /api/queue).
export default function ActiveQueue({ onOpenRecord, onOpenConsultation }: ActiveQueueProps) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const canTriage = user?.role === "nurse" || user?.role === "doctor";
  const canCheckIn = user?.role === "nurse" || user?.role === "doctor" || user?.role === "receptionist";
  const [arrivalPatient, setArrivalPatient] = useState<Patient | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
      .catch((err) => setError(err instanceof ApiError ? err.message : t("Le serveur Pédiatrix est injoignable.")))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  async function handleCheckIn() {
    if (!arrivalPatient) return;
    setActionError(null);
    try {
      await checkInPatient(arrivalPatient.id);
      setArrivalPatient(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("Erreur inattendue."));
    }
  }

  const [vitalsFor, setVitalsFor] = useState<string | null>(null);
  const [vitalsDraft, setVitalsDraft] = useState<Record<string, string>>({});

  async function saveTriageWithVitals(entry: QueueEntry, category: TriageCategory) {
    setActionError(null);
    const vitals: Record<string, number> = {};
    for (const field of VITAL_FIELDS) {
      const raw = (vitalsDraft[field.key] ?? "").trim();
      if (raw) vitals[field.key] = Number(raw.replace(",", "."));
    }
    try {
      await setTriage(entry.patientId, category, undefined, vitals);
      setVitalsFor(null);
      setVitalsDraft({});
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("Erreur inattendue."));
    }
  }

  async function handleLeft(entry: QueueEntry) {
    if (!window.confirm(t("Retirer {name} de la file (parti sans consultation) ?", { name: entry.name }))) return;
    setActionError(null);
    try {
      await markLeftWithoutConsultation(entry.patientId);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("Erreur inattendue."));
    }
  }

  async function handleTriage(entry: QueueEntry, category: TriageCategory) {
    setActionError(null);
    try {
      await setTriage(entry.patientId, category);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("Erreur inattendue."));
    }
  }

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
    { id: "en_attente", label: t("En attente ({n})", { n: counts.en_attente }) },
    { id: "consulte", label: t("Consultés ({n})", { n: counts.consulte }) },
    { id: "tous", label: t("Tous ({n})", { n: counts.tous }) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">{t("File active des patients")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("Patients admis aujourd'hui, en attente ou déjà consultés")}</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
        >
          <RefreshCcw className="h-4 w-4" /> {t("Actualiser")}
        </button>
      </div>

      {canCheckIn && (
        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-96">
              <PatientPicker selected={arrivalPatient} onSelect={setArrivalPatient} label={t("Enregistrer l'arrivée d'un patient déjà connu")} />
            </div>
            <button
              onClick={handleCheckIn}
              disabled={!arrivalPatient}
              data-testid="check-in"
              className="flex items-center gap-2 rounded-full bg-[#1A6FD4] px-5 py-2.5 text-xs font-medium text-white transition hover:bg-[#155bb0] disabled:opacity-40"
            >
              <UserCheck className="h-4 w-4" /> {t("Ajouter à la file")}
            </button>
          </div>
          {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}
        </section>
      )}

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
              placeholder={t("Rechercher un patient…")}
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
              <th className="py-3 font-normal">{t("Patient")}</th>
              <th className="py-3 font-normal">{t("Âge")}</th>
              <th className="py-3 font-normal">{t("Tri")}</th>
              <th className="py-3 font-normal">{t("Constantes")}</th>
              <th className="py-3 font-normal">{t("Motif")}</th>
              <th className="py-3 font-normal">{t("Heure d'arrivée")}</th>
              <th className="py-3 font-normal">{t("Attente")}</th>
              <th className="py-3 font-normal">{t("Statut")}</th>
              <th className="py-3 text-right font-normal">{t("Action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-zinc-400">
                  {t("Chargement…")}
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-zinc-400">
                  {t("Aucun patient dans cette liste aujourd'hui.")}
                </td>
              </tr>
            )}
            {rows.map((entry, index) => (
              <Fragment key={entry.patientId}>
              <tr className="transition hover:bg-[#F4F7FB]">
                <td className="py-3 text-zinc-500">{String(index + 1).padStart(3, "0")}</td>
                <td className="py-3 text-zinc-900">{entry.name}</td>
                <td className="py-3 text-zinc-700">{ageOf(entry.birthDate, t)}</td>
                <td className="py-3">
                  {entry.triage ? (
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TRIAGE_STYLES[entry.triage].className)}>
                      {t(TRIAGE_STYLES[entry.triage].label)}
                    </span>
                  ) : canTriage && entry.status === "en_attente" ? (
                    <span className="text-xs text-zinc-400">{t("À trier")}</span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                  {canTriage && entry.status === "en_attente" && (
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {(Object.keys(TRIAGE_STYLES) as TriageCategory[]).map((category) => (
                        <button
                          key={category}
                          title={t("Classer : {label}", { label: t(TRIAGE_STYLES[category].label) })}
                          data-testid={`triage-${category}`}
                          onClick={() => handleTriage(entry, category)}
                          className={cn(
                            "h-4 w-4 rounded-full border border-white shadow ring-1 ring-zinc-200",
                            category === "emergency" && "bg-red-500",
                            category === "priority" && "bg-amber-400",
                            category === "non_urgent" && "bg-emerald-500",
                          )}
                        />
                      ))}
                    </span>
                  )}
                </td>
                <td className="py-3 text-xs">
                  {VITAL_FIELDS.filter((f) => entry.vitals?.[f.key] !== undefined).length === 0 ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-x-2">
                      {VITAL_FIELDS.filter((f) => entry.vitals?.[f.key] !== undefined).map((f) => (
                        <span
                          key={f.key}
                          data-testid={`vital-${f.key}`}
                          className={entry.criticalVitals?.includes(f.key) ? "font-semibold text-red-600" : "text-zinc-600"}
                        >
                          {t(f.label)} {entry.vitals[f.key]}
                          {f.unit}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="py-3 text-zinc-700">{entry.reason ?? "—"}</td>
                <td className="py-3 text-zinc-700">{timeOf(entry.admittedAt, LOCALES[lang])}</td>
                <td className="py-3">
                  {entry.status === "en_attente" && waitOf(entry.admittedAt, t) ? (
                    <span className={cn("text-xs", waitOf(entry.admittedAt, t)?.late ? "font-medium text-red-600" : "text-zinc-600")}>
                      {waitOf(entry.admittedAt, t)?.label}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs",
                      entry.status === "en_attente" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {t(STATUS_LABELS[entry.status])}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {onOpenConsultation && entry.status === "en_attente" && (
                      <button
                        onClick={() => onOpenConsultation(entry.patientId)}
                        className="rounded-lg bg-[#1A6FD4] px-3 py-1.5 text-xs text-white transition hover:bg-[#155bb0]"
                      >
                        {t("Consulter")}
                      </button>
                    )}
                    {canTriage && entry.status === "en_attente" && (
                      <button
                        data-testid="queue-vitals"
                        onClick={() => setVitalsFor(vitalsFor === entry.patientId ? null : entry.patientId)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
                      >
                        {t("Constantes")}
                      </button>
                    )}
                    {entry.status === "en_attente" && (
                      <button
                        data-testid="queue-left"
                        onClick={() => handleLeft(entry)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-red-300 hover:text-red-600"
                      >
                        {t("Parti")}
                      </button>
                    )}
                    <button
                      onClick={() => onOpenRecord(entry.patientId)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
                    >
                      {t("Voir")}
                    </button>
                  </div>
                </td>
              </tr>
              {vitalsFor === entry.patientId && (
                <tr className="bg-[#F4F7FB]">
                  <td colSpan={10} className="px-3 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                      {VITAL_FIELDS.map((f) => (
                        <label key={f.key} className="text-xs text-zinc-500">
                          {t(f.label)} ({f.unit})
                          <input
                            data-testid={`vitals-input-${f.key}`}
                            inputMode="decimal"
                            value={vitalsDraft[f.key] ?? ""}
                            onChange={(event) => setVitalsDraft({ ...vitalsDraft, [f.key]: event.target.value })}
                            className="mt-1 block w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                          />
                        </label>
                      ))}
                      <span className="text-xs text-zinc-500">{t("Enregistrer avec le tri :")}</span>
                      {(Object.keys(TRIAGE_STYLES) as TriageCategory[]).map((category) => (
                        <button
                          key={category}
                          data-testid={`vitals-save-${category}`}
                          onClick={() => saveTriageWithVitals(entry, category)}
                          className={cn("rounded-full px-3 py-1.5 text-xs font-medium", TRIAGE_STYLES[category].className)}
                        >
                          {t(TRIAGE_STYLES[category].label)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
