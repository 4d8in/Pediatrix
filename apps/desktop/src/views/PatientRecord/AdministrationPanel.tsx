import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { ApiError, getStayAdministrations, recordAdministration } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { Administration, Prescription } from "../../lib/types";

// Suivi d'administration des médicaments d'un séjour en cours : l'infirmier note chaque prise
// donnée ou non donnée (avec le motif) ; le médecin consulte.
export default function AdministrationPanel({ stayId, prescriptions }: { stayId: string; prescriptions: Prescription[] }) {
  const { t, formatDateTime } = useI18n();
  const { user } = useAuth();
  const canRecord = user?.role === "nurse";
  const [items, setItems] = useState<Administration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getStayAdministrations(stayId)
      .then((r) => setItems(r.administrations))
      .catch(() => setError(t("Historique indisponible : rechargez avant de donner un médicament.")));
  }, [stayId, t]);
  useEffect(load, [load]);

  async function record(prescriptionId: string, given: boolean) {
    setBusy(true);
    setError(null);
    try {
      await recordAdministration(stayId, { prescriptionId, given, note: given ? undefined : note.trim() });
      setRefusing(null);
      setNote("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Erreur lors de l'enregistrement."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-zinc-50 p-3" data-testid="administration-panel">
      <p className="text-xs font-medium text-zinc-700">{t("Administration des médicaments")}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {canRecord && prescriptions.length > 0 && (
        <ul className="space-y-1">
          {prescriptions.map((rx) => (
            <li key={rx.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex-1 text-zinc-800">
                {rx.medication ?? "—"} {rx.dosage ? `· ${rx.dosage}` : ""}
              </span>
              <button
                disabled={busy}
                onClick={() => record(rx.id, true)}
                data-testid="administration-given"
                className="rounded border border-green-300 px-2 py-1 text-green-700 hover:bg-green-50 disabled:opacity-40"
              >
                {t("Donné")}
              </button>
              <button
                disabled={busy}
                onClick={() => setRefusing(refusing === rx.id ? null : rx.id)}
                className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-white disabled:opacity-40"
              >
                {t("Non donné")}
              </button>
              {refusing === rx.id && (
                <span className="flex w-full gap-2">
                  <input
                    aria-label={t("Motif")}
                    value={note}
                    maxLength={500}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("Motif (requis)")}
                    className="flex-1 rounded border border-zinc-200 px-2 py-1"
                  />
                  <button
                    disabled={busy || !note.trim()}
                    onClick={() => record(rx.id, false)}
                    className="rounded bg-zinc-800 px-2 py-1 text-white disabled:opacity-40"
                  >
                    {t("Enregistrer")}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && !error ? (
        <p className="text-xs text-zinc-400">{t("Aucune administration enregistrée.")}</p>
      ) : (
        <ul className="space-y-0.5 text-xs text-zinc-600">
          {items.map((a) => (
            <li key={a.id}>
              {a.at ? formatDateTime(a.at) : "—"} · {a.medication ?? "—"} ·{" "}
              <span className={a.given ? "text-green-700" : "text-amber-700"}>{a.given ? t("donné") : t("non donné")}</span>
              {a.by ? ` · ${a.by}` : ""}
              {a.note ? ` · ${a.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
