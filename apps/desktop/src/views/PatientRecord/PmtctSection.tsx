import { useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { ApiError, enrolPmtct, recordPmtctTest, revokePmtctTest } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { PmtctFollowUp } from "../../lib/types";

const MOTHER: { value: string; label: string }[] = [
  { value: "on_art", label: "Mère sous traitement ARV" },
  { value: "not_on_art", label: "Mère sans traitement ARV" },
  { value: "unknown", label: "Statut de traitement inconnu" },
];

// Suivi du nourrisson exposé au VIH (PTME). Donnée très sensible : onglet réservé aux soignants.
export default function PmtctSection({ patientId, ptme, onChanged }: { patientId: string; ptme: PmtctFollowUp | null; onChanged: () => void }) {
  const { t, formatDate } = useI18n();
  const { user } = useAuth();
  const canWrite = user?.role === "nurse" || user?.role === "doctor";
  const [mother, setMother] = useState("");
  const [prophylaxis, setProphylaxis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sampleDate, setSampleDate] = useState("");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Erreur inattendue lors de l'enregistrement."));
    } finally {
      setBusy(false);
    }
  }

  if (!ptme) {
    if (!canWrite) return <p className="text-sm text-zinc-400">{t("Enfant non inscrit au suivi PTME.")}</p>;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => enrolPmtct(patientId, { motherStatus: mother, infantProphylaxis: prophylaxis }));
        }}
        className="space-y-4 rounded-[18px] border border-zinc-200/70 p-5"
        data-testid="pmtct-form"
      >
        <h2 className="text-sm font-medium">{t("Inscrire au suivi du nourrisson exposé au VIH")}</h2>
        {error && <p className="text-xs font-medium text-red-700">{error}</p>}
        <select
          required
          value={mother}
          data-testid="pmtct-mother"
          onChange={(event) => setMother(event.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">{t("Statut de la mère…")}</option>
          {MOTHER.map((m) => (
            <option key={m.value} value={m.value}>
              {t(m.label)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" checked={prophylaxis} onChange={(event) => setProphylaxis(event.target.checked)} />
          {t("Prophylaxie ARV donnée au nourrisson")}
        </label>
        <button disabled={busy || !mother} data-testid="pmtct-enrol" className="rounded-lg bg-[#1A6FD4] px-4 py-2 text-sm text-white disabled:opacity-40">
          {t("Inscrire")}
        </button>
      </form>
    );
  }

  const badge: Record<string, string> = {
    done: "bg-green-100 text-green-700",
    upcoming: "bg-zinc-100 text-zinc-600",
    due: "bg-amber-100 text-amber-800",
    overdue: "bg-red-100 text-red-700",
  };
  const stateLabel: Record<string, string> = { done: "Fait", upcoming: "À venir", due: "À faire", overdue: "En retard" };

  return (
    <section className="space-y-3 rounded-[18px] border border-zinc-200/70 p-5 text-sm" data-testid="pmtct-record">
      <h2 className="font-medium">{t("Suivi du nourrisson exposé au VIH")}</h2>
      {ptme.status === "positive" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{t("Résultat positif : orienter vers la prise en charge pédiatrique du VIH.")}</p>
      )}
      {ptme.status === "cleared" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-green-700">{t("Sérologie finale négative : fin du suivi d'exposition.")}</p>
      )}
      <p className="text-zinc-600">
        {t(MOTHER.find((m) => m.value === ptme.enrolment.motherStatus)?.label ?? "")} ·{" "}
        {ptme.enrolment.infantProphylaxis ? t("prophylaxie ARV du nourrisson donnée") : t("prophylaxie ARV du nourrisson non notée")}
      </p>
      {error && <p className="text-xs font-medium text-red-700">{error}</p>}
      {canWrite && (
        <label className="block text-xs text-zinc-500">
          {t("Date du prélèvement (facultative, AAAA-MM-JJ)")}
          <input
            value={sampleDate}
            onChange={(event) => setSampleDate(event.target.value)}
            placeholder={t("AAAA-MM-JJ")}
            className="ml-2 w-32 rounded border border-zinc-200 px-2 py-1"
          />
        </label>
      )}
      <ul className="space-y-2">
        {ptme.milestones.map((m) => (
          <li key={m.key} className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-zinc-800">
              {t(m.label)} · {m.dueDate ? formatDate(m.dueDate) : "—"}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${badge[m.state]}`}>
              {m.result ? `${m.result === "positive" ? t("Positif") : t("Négatif")}${m.resultDate ? ` · ${formatDate(m.resultDate)}` : ""}` : t(stateLabel[m.state])}
            </span>
            {user?.role === "doctor" && m.result && (
              <button
                disabled={busy}
                data-testid={`pmtct-revoke-${m.key}`}
                onClick={() => {
                  const reason = window.prompt(t("Motif de la correction (requis)"));
                  if (reason && reason.trim().length >= 5) void run(() => revokePmtctTest(patientId, m.key, reason.trim()));
                }}
                className="text-xs text-zinc-500 underline disabled:opacity-40"
              >
                {t("Annuler ce résultat")}
              </button>
            )}
            {canWrite && !m.result && (
              <>
                <button
                  disabled={busy}
                  data-testid={`pmtct-negative-${m.key}`}
                  onClick={() => void run(() => recordPmtctTest(patientId, { milestone: m.key, result: "negative", sampleDate: sampleDate || undefined }))}
                  className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 disabled:opacity-40"
                >
                  {t("Négatif")}
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    window.confirm(t("Enregistrer un résultat POSITIF ? Il ne pourra plus être modifié.")) &&
                    void run(() => recordPmtctTest(patientId, { milestone: m.key, result: "positive", sampleDate: sampleDate || undefined }))
                  }
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-40"
                >
                  {t("Positif")}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-400">
        {t("Cotrimoxazole habituellement débuté dès 6 semaines jusqu'à l'exclusion de l'infection. Calendrier à valider par le programme national.")}
      </p>
    </section>
  );
}
