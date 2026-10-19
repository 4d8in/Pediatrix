import { DISCHARGE_OUTCOMES } from "../../lib/types";
import type { PatientStay } from "../../lib/types";
import { useI18n } from "../../lib/i18n";

function durationDays(start: string | null, end: string | null, t: (fr: string, vars?: Record<string, string | number>) => string): string {
  if (!start) return "—";
  const days = Math.floor(((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 86_400_000);
  return days < 1 ? t("< 1 j") : t("{n} j", { n: days });
}

// Séjours hospitaliers du patient (module Hospitalisation), avec les lits occupés.
export default function StaysSection({ stays, onPrintSummary }: { stays: PatientStay[]; onPrintSummary?: (stay: PatientStay) => void }) {
  const { t, formatDate } = useI18n();
  const fmt = (date: string | null) => (date ? formatDate(date) : "—");
  return (
    <section className="rounded-[18px] border border-zinc-200/70 bg-white">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-sm font-medium">{t("Hospitalisations")}</h2>
      </div>
      {stays.length === 0 ? (
        <p className="p-5 text-sm text-zinc-400">{t("Aucune hospitalisation enregistrée.")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {stays.map((stay) => (
            <li key={stay.id} className="space-y-1 p-5 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900">
                  {t("Du {debut}", { debut: fmt(stay.start) })} {stay.end ? t("au {fin}", { fin: fmt(stay.end) }) : ""} · {durationDays(stay.start, stay.end, t)}
                </p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    stay.inProgress ? "bg-[#1A6FD4]/10 text-[#1A6FD4]" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {stay.inProgress ? t("En cours") : t("Terminé")}
                </span>
              </div>
              {stay.reason && <p className="text-zinc-600">{t("Motif : {motif}", { motif: stay.reason })}</p>}
              <p className="text-zinc-500">{t("Lits : {lits}", { lits: stay.beds.map((bed) => bed.name).join(" → ") || "—" })}</p>
              {stay.outcome && (
                <p className="text-zinc-600">
                  {t("Issue du séjour :")} {t(DISCHARGE_OUTCOMES.find((item) => item.value === stay.outcome)?.label ?? "")}
                </p>
              )}
              {stay.summary && <p className="text-zinc-600">{stay.summary}</p>}
              {!stay.inProgress && onPrintSummary && (
                <button
                  onClick={() => onPrintSummary(stay)}
                  data-testid="print-discharge-summary"
                  className="mt-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
                >
                  {t("Imprimer le résumé de sortie")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
