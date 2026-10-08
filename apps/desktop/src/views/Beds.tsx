import { useCallback, useEffect, useState } from "react";
import { BedDouble, LogOut as DischargeIcon, RefreshCcw, Repeat } from "lucide-react";
import PatientPicker from "../components/PatientPicker";
import { ApiError, dischargeStay, hospitalise, listBeds, setBedStatus, transferStay } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { Bed, BedStatus, Patient, Ward } from "../lib/types";
import { cn } from "../lib/utils";

const STATUS_LABELS: Record<BedStatus, string> = {
  U: "Libre",
  O: "Occupé",
  H: "En nettoyage",
  C: "Fermé",
};

const STATUS_STYLES: Record<BedStatus, string> = {
  U: "border-emerald-200 bg-emerald-50 text-emerald-700",
  O: "border-[#1A6FD4]/30 bg-[#1A6FD4]/10 text-[#1A6FD4]",
  H: "border-amber-200 bg-amber-50 text-amber-700",
  C: "border-zinc-200 bg-zinc-100 text-zinc-500",
};

function daysSince(date: string | null): string {
  if (!date) return "—";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
  return days < 1 ? "Aujourd'hui" : `${days} j`;
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable.";
}

// Gestion des lits : occupation par service, hospitalisation, transfert, sortie
// et état des lits (GET /api/beds et routes /api/hospitalisations).
export default function Beds() {
  const { user } = useAuth();
  const canManageStays = user?.role === "nurse" || user?.role === "doctor";
  const canSetStatus = user?.role === "nurse" || user?.role === "tech_admin";

  const [wards, setWards] = useState<Ward[]>([]);
  const [tab, setTab] = useState<"beds" | "stays">("beds");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reason, setReason] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    listBeds()
      .then((data) => {
        setWards(data.wards);
        setError(null);
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  const allBeds = wards.flatMap((ward) => ward.beds.map((bed) => ({ ...bed, wardName: ward.name })));
  const selected = allBeds.find((bed) => bed.id === selectedId) ?? null;
  const freeBeds = allBeds.filter((bed) => bed.status === "U");
  const count = (status: BedStatus) => allBeds.filter((bed) => bed.status === status).length;

  function selectBed(bed: Bed) {
    setSelectedId(bed.id);
    setPatient(null);
    setReason("");
    setTransferTo("");
    setError(null);
  }

  async function run(action: () => Promise<unknown>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      setPatient(null);
      setReason("");
      setTransferTo("");
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsBusy(false);
    }
  }

  const summary = [
    { label: "Total lits", value: allBeds.length, className: "text-zinc-900" },
    { label: "Occupés", value: count("O"), className: "text-[#1A6FD4]" },
    { label: "Libres", value: count("U"), className: "text-emerald-600" },
    { label: "En nettoyage", value: count("H"), className: "text-amber-600" },
    { label: "Fermés", value: count("C"), className: "text-zinc-500" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">Gestion des lits</h1>
          <p className="mt-1 text-sm text-zinc-500">Occupation des lits par service et hospitalisations en cours</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
        >
          <RefreshCcw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {summary.map((item) => (
          <div key={item.label} className="rounded-[18px] border border-zinc-200/70 bg-white p-4">
            <p className="text-sm text-zinc-500">{item.label}</p>
            <p className={cn("mt-1 text-[26px] font-medium", item.className)}>{isLoading ? "…" : item.value}</p>
          </div>
        ))}
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!isLoading && wards.length === 0 && !error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Aucun lit configuré. Lancez le script de création des lits (voir README, « Gestion des lits »).
        </p>
      )}

      <div className="flex gap-1 border-b border-zinc-200">
        {(
          [
            ["beds", "Lits"],
            ["stays", `Hospitalisations en cours (${count("O")})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm transition",
              tab === id ? "border-[#1A6FD4] font-medium text-[#1A6FD4]" : "border-transparent text-zinc-500 hover:text-zinc-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "beds" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {wards.map((ward) => (
              <section key={ward.id} className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg text-zinc-700">{ward.name}</h2>
                  <p className="text-sm text-zinc-500">
                    {ward.beds.filter((bed) => bed.status === "O").length} occupé(s) ·{" "}
                    {ward.beds.filter((bed) => bed.status === "U").length} libre(s) / {ward.beds.length}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {ward.beds.map((bed) => (
                    <button
                      key={bed.id}
                      onClick={() => selectBed(bed)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition hover:shadow-sm",
                        STATUS_STYLES[bed.status],
                        selectedId === bed.id && "ring-2 ring-[#1A6FD4]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <BedDouble className="h-4 w-4" /> {bed.name}
                        </span>
                        <span className="text-[11px]">{STATUS_LABELS[bed.status]}</span>
                      </div>
                      <p className="mt-2 truncate text-xs text-zinc-700">
                        {bed.stay ? bed.stay.patientName : " "}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="h-fit rounded-[18px] border border-zinc-200/70 bg-white p-5">
            {!selected ? (
              <p className="py-10 text-center text-sm text-zinc-400">Sélectionnez un lit pour voir les actions.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-medium text-zinc-900">Lit {selected.name}</p>
                  <p className="text-sm text-zinc-500">
                    {selected.wardName} · {STATUS_LABELS[selected.status]}
                  </p>
                </div>

                {selected.stay && (
                  <div className="rounded-xl bg-[#F4F7FB] p-3 text-sm">
                    <p className="font-medium text-zinc-900">{selected.stay.patientName}</p>
                    <p className="text-zinc-500">
                      Depuis le {selected.stay.since ? new Date(selected.stay.since).toLocaleDateString("fr-FR") : "—"} (
                      {daysSince(selected.stay.since)})
                    </p>
                    {selected.stay.reason && <p className="mt-1 text-zinc-600">Motif : {selected.stay.reason}</p>}
                  </div>
                )}

                {selected.status === "U" && canManageStays && (
                  <div className="space-y-3">
                    <PatientPicker selected={patient} onSelect={setPatient} label="Patient à hospitaliser" />
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Motif d'hospitalisation (optionnel)"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1A6FD4]"
                    />
                    <button
                      disabled={!patient || isBusy}
                      onClick={() => patient && run(() => hospitalise(patient.id, selected.id, reason))}
                      className="w-full rounded-lg bg-[#1A6FD4] py-2.5 text-sm font-medium text-white transition hover:bg-[#155bb0] disabled:opacity-40"
                    >
                      Hospitaliser dans ce lit
                    </button>
                  </div>
                )}

                {selected.stay && canManageStays && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <select
                        aria-label="Nouveau lit"
                        value={transferTo}
                        onChange={(event) => setTransferTo(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1A6FD4]"
                      >
                        <option value="">Transférer vers…</option>
                        {freeBeds.map((bed) => (
                          <option key={bed.id} value={bed.id}>
                            {bed.name} — {bed.wardName}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!transferTo || isBusy}
                        onClick={() => selected.stay && run(() => transferStay(selected.stay!.stayId, transferTo))}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4] disabled:opacity-40"
                      >
                        <Repeat className="h-4 w-4" /> Transférer
                      </button>
                    </div>
                    <button
                      disabled={isBusy}
                      onClick={() => {
                        if (selected.stay && window.confirm(`Confirmer la sortie de ${selected.stay.patientName} ?`)) {
                          run(() => dischargeStay(selected.stay!.stayId));
                        }
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                    >
                      <DischargeIcon className="h-4 w-4" /> Sortie du patient
                    </button>
                  </div>
                )}

                {selected.status !== "O" && canSetStatus && (
                  <div className="space-y-2 border-t border-zinc-100 pt-4">
                    <p className="text-sm text-zinc-500">État du lit</p>
                    <div className="flex flex-wrap gap-2">
                      {(["U", "H", "C"] as const)
                        .filter((status) => status !== selected.status)
                        .map((status) => (
                          <button
                            key={status}
                            disabled={isBusy}
                            onClick={() => run(() => setBedStatus(selected.id, status))}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4] disabled:opacity-40"
                          >
                            Marquer « {STATUS_LABELS[status]} »
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {!canManageStays && !canSetStatus && (
                  <p className="text-sm text-zinc-400">Consultation seule pour votre rôle.</p>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === "stays" && (
        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="py-3 font-normal">Patient</th>
                <th className="py-3 font-normal">Service</th>
                <th className="py-3 font-normal">Lit</th>
                <th className="py-3 font-normal">Admis le</th>
                <th className="py-3 font-normal">Durée</th>
                <th className="py-3 font-normal">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {allBeds.filter((bed) => bed.stay).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-400">
                    Aucune hospitalisation en cours.
                  </td>
                </tr>
              )}
              {allBeds
                .filter((bed) => bed.stay)
                .map((bed) => (
                  <tr
                    key={bed.id}
                    onClick={() => {
                      selectBed(bed);
                      setTab("beds");
                    }}
                    className="cursor-pointer transition hover:bg-[#F4F7FB]"
                  >
                    <td className="py-3 text-zinc-900">{bed.stay!.patientName}</td>
                    <td className="py-3 text-zinc-700">{bed.wardName}</td>
                    <td className="py-3 text-zinc-700">{bed.name}</td>
                    <td className="py-3 text-zinc-700">
                      {bed.stay!.since ? new Date(bed.stay!.since).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="py-3 text-zinc-700">{daysSince(bed.stay!.since)}</td>
                    <td className="py-3 text-zinc-700">{bed.stay!.reason ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
