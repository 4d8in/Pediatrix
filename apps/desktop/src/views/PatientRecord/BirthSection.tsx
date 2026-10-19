import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../lib/auth-context";
import { ApiError, createBirth } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { BirthAlert, BirthRecord } from "../../lib/types";

const ALERT_LABELS: Record<BirthAlert, string> = {
  very_low_birth_weight: "Très faible poids de naissance (moins de 1500 g)",
  low_birth_weight: "Faible poids de naissance (moins de 2500 g)",
  preterm: "Prématuré (moins de 37 semaines)",
  low_apgar: "Apgar à 5 minutes inférieur à 7",
};

const DELIVERY: { value: string; label: string }[] = [
  { value: "vaginal", label: "Voie basse" },
  { value: "caesarean", label: "Césarienne" },
  { value: "assisted", label: "Voie basse instrumentale" },
];

export default function BirthSection({ patientId, birth, onCreated }: { patientId: string; birth: BirthRecord | null; onCreated: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const canWrite = user?.role === "nurse" || user?.role === "doctor";
  const [weight, setWeight] = useState("");
  const [gestation, setGestation] = useState("");
  const [apgar1, setApgar1] = useState("");
  const [apgar5, setApgar5] = useState("");
  const [mode, setMode] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      await createBirth(patientId, {
        birthWeightG: Number(weight),
        gestationalAgeWeeks: gestation ? Number(gestation) : undefined,
        apgar1: apgar1 !== "" ? Number(apgar1) : undefined,
        apgar5: apgar5 !== "" ? Number(apgar5) : undefined,
        deliveryMode: mode || undefined,
      });
      onCreated();
    } catch (error) {
      setErrors(error instanceof ApiError ? (error.details ?? [error.message]) : [t("Erreur inattendue lors de l'enregistrement.")]);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#1A6FD4]";

  if (birth) {
    return (
      <section className="space-y-3 rounded-[18px] border border-zinc-200/70 p-5 text-sm" data-testid="birth-record">
        <h2 className="font-medium">{t("Naissance")}</h2>
        {birth.alerts.map((alert) => (
          <p key={alert} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            {t(ALERT_LABELS[alert])}
          </p>
        ))}
        <ul className="space-y-1 text-zinc-700">
          <li>{t("Poids de naissance : {n} g", { n: birth.birthWeightG })}</li>
          {birth.gestationalAgeWeeks !== undefined && <li>{t("Âge gestationnel : {n} semaines", { n: birth.gestationalAgeWeeks })}</li>}
          {birth.apgar1 !== undefined && <li>{t("Apgar à 1 minute : {n}", { n: birth.apgar1 })}</li>}
          {birth.apgar5 !== undefined && <li>{t("Apgar à 5 minutes : {n}", { n: birth.apgar5 })}</li>}
          {birth.deliveryMode && <li>{t(DELIVERY.find((d) => d.value === birth.deliveryMode)?.label ?? "")}</li>}
        </ul>
      </section>
    );
  }

  if (!canWrite) return <p className="text-sm text-zinc-400">{t("Aucune donnée de naissance enregistrée.")}</p>;

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[18px] border border-zinc-200/70 p-5" data-testid="birth-form">
      <h2 className="text-sm font-medium">{t("Naissance")}</h2>
      {errors.map((message) => (
        <p key={message} className="text-xs font-medium text-red-700">
          {message}
        </p>
      ))}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <label className="space-y-1 text-sm text-zinc-500">
          {t("Poids (g)")}
          <input required type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className={field} data-testid="birth-weight" />
        </label>
        <label className="space-y-1 text-sm text-zinc-500">
          {t("Âge gestationnel (semaines)")}
          <input type="number" value={gestation} onChange={(e) => setGestation(e.target.value)} className={field} />
        </label>
        <label className="space-y-1 text-sm text-zinc-500">
          {t("Apgar 1 min")}
          <input type="number" min={0} max={10} value={apgar1} onChange={(e) => setApgar1(e.target.value)} className={field} />
        </label>
        <label className="space-y-1 text-sm text-zinc-500">
          {t("Apgar 5 min")}
          <input type="number" min={0} max={10} value={apgar5} onChange={(e) => setApgar5(e.target.value)} className={field} />
        </label>
        <label className="space-y-1 text-sm text-zinc-500">
          {t("Accouchement")}
          <select value={mode} onChange={(e) => setMode(e.target.value)} className={field}>
            <option value="">—</option>
            {DELIVERY.map((d) => (
              <option key={d.value} value={d.value}>
                {t(d.label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button disabled={busy || !weight} className="rounded-lg bg-[#1A6FD4] px-4 py-2 text-sm text-white disabled:opacity-40" data-testid="birth-save">
        {t("Enregistrer")}
      </button>
    </form>
  );
}
