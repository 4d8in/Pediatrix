import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Download, FileJson, RefreshCw } from "lucide-react";
import { ApiError, getDhis2Export, getDhis2Mapping, getIndicators, saveDhis2Mapping } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { downloadFile, toCsv } from "../lib/download";
import type { IndicatorRow } from "../lib/types";
import { useI18n } from "../lib/i18n";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

const MAPPING_EXAMPLE = `{
  "orgUnit": "AbCdEfGhIjK",
  "dataSet": "LmNoPqRsTuV",
  "dataElements": {
    "consultations": "WxYzAbCdEfG",
    "dx_B50.9": "HiJkLmNoPqR"
  }
}`;

// Rapport mensuel d'activité (direction, administration) : indicateurs, export CSV et fichier DHIS2.
export default function Reporting() {
  const { user } = useAuth();
  const { t } = useI18n();

  function errorText(error: unknown): string {
    if (error instanceof ApiError) return [error.message, ...(error.details ?? [])].join(" ");
    return t("Erreur inattendue.");
  }
  const isAdmin = user?.role === "tech_admin";

  const [month, setMonth] = useState(currentMonth());
  const [indicators, setIndicators] = useState<IndicatorRow[]>([]);
  const [mappingConfigured, setMappingConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const [mappingText, setMappingText] = useState("");
  const [mappingMessage, setMappingMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const period = month.replace("-", "");

  // Libellés d'indicateurs fournis par le backend (en français) : traduits à l'affichage seulement,
  // l'export CSV garde le libellé d'origine.
  function indicatorLabel(row: IndicatorRow): string {
    if (row.id.startsWith("dx_")) return row.label.replace(/^Diagnostic /, `${t("Diagnostic")} `);
    return t(row.label);
  }

  const load = useCallback(() => {
    setIsLoading(true);
    setMessage(null);
    getIndicators(period)
      .then((data) => {
        setIndicators(data.indicators);
        setMappingConfigured(data.mappingConfigured);
      })
      .catch((error) => setMessage({ kind: "error", text: errorText(error) }))
      .finally(() => setIsLoading(false));
  }, [period]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    getDhis2Mapping()
      .then((data) => setMappingText(data.mapping ? JSON.stringify(data.mapping, null, 2) : ""))
      .catch(() => undefined);
  }, [isAdmin]);

  function exportCsv() {
    downloadFile(
      `pediatrix-indicateurs-${period}.csv`,
      toCsv(["Indicateur", "Valeur"], indicators.map((row) => [row.label, row.value])),
      "text/csv",
    );
  }

  async function exportDhis2() {
    setMessage(null);
    try {
      const { dataValueSet, unmapped } = await getDhis2Export(period);
      downloadFile(`dhis2-${period}.json`, JSON.stringify(dataValueSet, null, 2), "application/json");
      setMessage({
        kind: "info",
        text: unmapped.length > 0 ? t("Fichier DHIS2 exporté. {n} indicateur(s) sans correspondance ont été ignorés.", { n: unmapped.length }) : t("Fichier DHIS2 exporté."),
      });
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    }
  }

  async function handleSaveMapping(event: FormEvent) {
    event.preventDefault();
    setMappingMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(mappingText);
    } catch {
      setMappingMessage({ kind: "error", text: t("Le texte n'est pas un JSON valide.") });
      return;
    }
    try {
      await saveDhis2Mapping(parsed as never);
      setMappingMessage({ kind: "info", text: t("Correspondance enregistrée.") });
      load();
    } catch (error) {
      setMappingMessage({ kind: "error", text: errorText(error) });
    }
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">{t("Rapports")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("Indicateurs mensuels d'activité et export vers DHIS2")}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} /> {t("Actualiser")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          data-testid="reporting-month"
          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-[#1A6FD4]"
        />
        <button
          onClick={exportCsv}
          disabled={indicators.length === 0}
          data-testid="export-csv"
          className="flex items-center gap-2 rounded-full border border-zinc-200 px-5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {t("Exporter en CSV")}
        </button>
        <button
          onClick={exportDhis2}
          data-testid="export-dhis2"
          className="flex items-center gap-2 rounded-full bg-[#1A6FD4] px-5 py-2 text-xs font-medium text-white hover:bg-[#155bb0]"
        >
          <FileJson className="h-4 w-4" /> {t("Fichier DHIS2")}
        </button>
      </div>

      {message && <p className={`text-sm ${message.kind === "error" ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}

      <div className="overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 text-xs text-zinc-400">
            <tr>
              <th className="px-6 py-3 font-medium">{t("Indicateur")}</th>
              <th className="px-3 py-3 font-medium">{t("Valeur")}</th>
              <th className="px-3 py-3 font-medium">DHIS2</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {indicators.map((row) => (
              <tr key={row.id}>
                <td className="px-6 py-3 text-zinc-900">{indicatorLabel(row)}</td>
                <td className="px-3 py-3 font-medium text-zinc-900">{row.value}</td>
                <td className="px-3 py-3 text-xs">
                  {row.mapped ? <span className="text-green-700">{t("Relié")}</span> : <span className="text-zinc-400">{t("Non relié")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!mappingConfigured && (
        <p className="text-xs text-zinc-500">
          {t("Aucune correspondance DHIS2 : l'administrateur technique doit renseigner l'unité d'organisation et les éléments de données.")}
        </p>
      )}

      {isAdmin && (
        <form onSubmit={handleSaveMapping} className="max-w-2xl space-y-3 rounded-[18px] border border-zinc-200/70 bg-white p-6">
          <h2 className="text-sm font-medium text-zinc-900">{t("Correspondance DHIS2")}</h2>
          <p className="text-xs text-zinc-500">
            {t("Associez chaque indicateur (clé) à l'identifiant de l'élément de données DHIS2 de votre pays (11 caractères). Les diagnostics s'écrivent « dx_ » suivi du code CIM-10, par exemple dx_B50.9.")}
          </p>
          <textarea
            value={mappingText}
            onChange={(event) => setMappingText(event.target.value)}
            rows={10}
            placeholder={MAPPING_EXAMPLE}
            data-testid="dhis2-mapping"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs outline-none focus:border-[#1A6FD4]"
          />
          {mappingMessage && (
            <p className={`text-xs ${mappingMessage.kind === "error" ? "text-red-600" : "text-green-700"}`}>{mappingMessage.text}</p>
          )}
          <button type="submit" className="rounded-full bg-[#1A6FD4] px-6 py-2.5 text-xs font-medium text-white hover:bg-[#155bb0]">
            {t("Enregistrer")}
          </button>
        </form>
      )}
    </div>
  );
}
