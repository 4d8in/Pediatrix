import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { ApiError, getWeeklySurveillance } from "../lib/api";
import { downloadFile, toCsv } from "../lib/download";
import { useI18n } from "../lib/i18n";
import type { SurveillanceReport } from "../lib/types";

// Semaine ISO de la date du jour (lundi au dimanche, en UTC), au format AAAA-Sww.
function currentIsoWeek(): string {
  const d = new Date();
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dow + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Surveillance épidémiologique hebdomadaire : cas des maladies prioritaires, alertes, export.
export default function Surveillance() {
  const { t, formatDate } = useI18n();
  const [week, setWeek] = useState(currentIsoWeek);
  const [report, setReport] = useState<SurveillanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    getWeeklySurveillance(week)
      .then(setReport)
      .catch((err) => {
        setReport(null);
        setError(err instanceof ApiError ? err.message : t("Erreur inattendue."));
      })
      .finally(() => setIsLoading(false));
  }, [week, t]);

  useEffect(load, [load]);

  const alerts = report?.rows.filter((row) => row.alert) ?? [];

  function exportCsv() {
    if (!report) return;
    const rows = report.rows.map((row) => [
      row.label,
      row.tier === "immediate" ? "immediate" : "weekly",
      row.cases,
      row.confirmed,
      row.underFive,
      row.previousAverage,
      row.alert ?? "",
    ]);
    downloadFile(
      `surveillance-${report.week}.csv`,
      toCsv(["Maladie", "Type", "Cas", "Confirmés", "Moins de 5 ans", "Moyenne 4 semaines précédentes", "Alerte"], rows),
      "text/csv",
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">{t("Surveillance épidémiologique")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("Cas des maladies prioritaires par semaine, d'après les diagnostics saisis")}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">
            {t("Semaine")}
            <input
              data-testid="surveillance-week"
              value={week}
              onChange={(event) => setWeek(event.target.value.trim())}
              placeholder="2026-W43"
              className="ml-2 w-28 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
            />
          </label>
          <button onClick={load} className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50" aria-label={t("Actualiser")}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={exportCsv}
            disabled={!report}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> {t("Exporter en CSV")}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && (
        <>
          <p className="text-xs text-zinc-500">
            {t("Du {debut} au {fin}", { debut: formatDate(report.from), fin: formatDate(new Date(Date.parse(report.to) - 1).toISOString()) })}
          </p>

          {alerts.length > 0 && (
            <div data-testid="surveillance-alerts" className="space-y-1 rounded-[18px] border border-red-200 bg-red-50 p-4">
              {alerts.map((row) => (
                <p key={row.key} className="flex items-center gap-2 text-sm text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <strong>{t(row.label)}</strong>
                  {row.alert === "immediate"
                    ? t("{n} cas : à déclarer immédiatement au niveau supérieur", { n: row.cases })
                    : t("{n} cas, au moins le double de la moyenne des 4 semaines précédentes ({avg})", { n: row.cases, avg: row.previousAverage })}
                </p>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs text-zinc-400">
                <tr>
                  <th className="px-5 py-3 font-medium">{t("Maladie")}</th>
                  <th className="px-3 py-3 font-medium">{t("Déclaration")}</th>
                  <th className="px-3 py-3 font-medium">{t("Cas")}</th>
                  <th className="px-3 py-3 font-medium">{t("Confirmés")}</th>
                  <th className="px-3 py-3 font-medium">{t("Moins de 5 ans")}</th>
                  <th className="px-3 py-3 font-medium">{t("Moy. 4 sem. préc.")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {report.rows.map((row) => (
                  <tr key={row.key} className={row.alert ? "bg-red-50/50" : ""}>
                    <td className="px-5 py-2.5 text-zinc-900">{t(row.label)}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">{row.tier === "immediate" ? t("Immédiate") : t("Hebdomadaire")}</td>
                    <td className={`px-3 py-2.5 font-medium ${row.alert ? "text-red-700" : "text-zinc-900"}`}>{row.cases}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{row.confirmed}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{row.underFive}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{row.previousAverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.immediateCases.length > 0 && (
            <div className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
              <h2 className="text-sm font-medium text-zinc-900">{t("Cas à déclaration immédiate")}</h2>
              <ul className="mt-2 divide-y divide-zinc-100 text-sm">
                {report.immediateCases.map((c, index) => (
                  <li key={`${c.date}-${index}`} className="flex justify-between py-2">
                    <span>
                      {t(c.disease)} ({t("CIM-10")} {c.code})
                    </span>
                    <span className="text-zinc-500">
                      {formatDate(c.date)} · {c.ageMonths === null ? "?" : t("{n} mois", { n: c.ageMonths })} · {c.sex === "female" ? t("F") : c.sex === "male" ? t("M") : "?"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-zinc-400">
            {t("Liste des maladies et seuils d'alerte de départ : à adapter à la liste nationale de surveillance (IDSR) avant usage.")}
          </p>
        </>
      )}
    </div>
  );
}
