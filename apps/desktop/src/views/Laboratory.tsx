import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, FlaskConical, Plus, RefreshCw, Trash2, User } from "lucide-react";
import CompletedRequests from "../components/CompletedRequests";
import ServiceSummary from "../components/ServiceSummary";
import { ApiError, getLabCatalog, getReferenceRanges, getLabSummary, createReport, listLabRequests } from "../lib/api";
import type { LabRequest, LabResultInput, LabTest, ResultFlag } from "../lib/types";
import { useI18n } from "../lib/i18n";

const EMPTY_ROW: LabResultInput = { label: "", value: "" };

const FLAG_STYLE: Record<ResultFlag, { label: string; className: string }> = {
  HH: { label: "Critique élevé", className: "bg-red-600 text-white border-red-700" },
  LL: { label: "Critique bas", className: "bg-red-600 text-white border-red-700" },
  H: { label: "Élevé", className: "bg-red-50 text-red-700 border-red-200" },
  L: { label: "Bas", className: "bg-amber-50 text-amber-700 border-amber-200" },
  N: { label: "Normal", className: "bg-green-50 text-green-700 border-green-200" },
};

// Même règle que le backend : pas de plage saisie, pas de jugement.
function flagFor(row: LabResultInput): ResultFlag | null {
  const value = Number(row.value.replace(",", "."));
  if (row.value.trim() === "" || !Number.isFinite(value)) return null;
  const low = row.referenceLow?.trim() ? Number(row.referenceLow.replace(",", ".")) : undefined;
  const high = row.referenceHigh?.trim() ? Number(row.referenceHigh.replace(",", ".")) : undefined;
  if ((low === undefined || Number.isNaN(low)) && (high === undefined || Number.isNaN(high))) return null;
  if (row.criticalLow !== undefined && value < row.criticalLow) return "LL";
  if (row.criticalHigh !== undefined && value > row.criticalHigh) return "HH";
  if (low !== undefined && !Number.isNaN(low) && value < low) return "L";
  if (high !== undefined && !Number.isNaN(high) && value > high) return "H";
  return "N";
}

// Lignes à saisir pour une demande : les analyses du catalogue (une seule, ou celles
// d'un panel comme la NFS) ; une demande en texte libre garde une ligne vide.
function rowsForRequest(request: LabRequest, catalog: LabTest[]): LabResultInput[] {
  const entry = request.examCode ? catalog.find((test) => test.code === request.examCode) : undefined;
  if (!entry) return [EMPTY_ROW];
  const analytes = entry.panel ? entry.panel.map((code) => catalog.find((test) => test.code === code)) : [entry];
  const rows = analytes
    .filter((test): test is LabTest => test !== undefined)
    .map((test): LabResultInput => ({ label: test.display, value: "", code: test.code, unit: test.unit ?? "" }));
  return rows.length > 0 ? rows : [EMPTY_ROW];
}

// La file peut rester momentanément périmée juste après la création d'une
// demande côté Pédiatrie (voir scripts/verify-lab-flow.sh) : ce rafraîchissement
// automatique rattrape ce cas sans que le technicien ait à recharger l'écran.
const AUTO_REFRESH_INTERVAL_MS = 15_000;

export default function Laboratory() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");
  const loadCompleted = useCallback(() => listLabRequests("completed"), []);
  const [requests, setRequests] = useState<LabRequest[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LabRequest | null>(null);

  const [catalog, setCatalog] = useState<LabTest[]>([]);
  const [results, setResults] = useState<LabResultInput[]>([EMPTY_ROW]);
  const [conclusion, setConclusion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function loadQueue() {
    setIsLoadingQueue(true);
    setQueueError(null);
    listLabRequests()
      .then((data) => setRequests(data.requests))
      .catch((err) => setQueueError(err instanceof ApiError ? err.message : t("Erreur de chargement de la file.")))
      .finally(() => setIsLoadingQueue(false));
  }

  // Sans catalogue (erreur réseau), la saisie libre habituelle reste disponible.
  useEffect(() => {
    getLabCatalog()
      .then((data) => setCatalog(data.tests))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    loadQueue();
    const intervalId = setInterval(loadQueue, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  function selectRequest(request: LabRequest) {
    setSelected(request);
    const rows = rowsForRequest(request, catalog);
    setResults(rows);
    // Valeurs de référence proposées d'après l'âge et le sexe (modifiables) ; sans réponse, saisie manuelle.
    getReferenceRanges(request.id)
      .then(({ ranges }) =>
        setResults((current) =>
          current.map((row) => {
            const ref = row.code ? ranges[row.code] : undefined;
            if (!ref) return row;
            return {
              ...row,
              referenceLow: row.referenceLow || (ref.low !== undefined ? String(ref.low) : ""),
              referenceHigh: row.referenceHigh || (ref.high !== undefined ? String(ref.high) : ""),
              criticalLow: ref.criticalLow,
              criticalHigh: ref.criticalHigh,
            };
          }),
        ),
      )
      .catch(() => undefined);
    setConclusion("");
    setErrors([]);
    setSubmitted(false);
  }

  function updateResultRow(index: number, field: keyof LabResultInput, value: string) {
    setResults((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeResultRow(index: number) {
    setResults((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    setErrors([]);
    setIsSubmitting(true);

    try {
      await createReport(selected.id, { results, conclusion: conclusion || undefined });
      setSubmitted(true);
      setRequests((rows) => rows.filter((row) => row.id !== selected.id));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors([t("Erreur inattendue lors de l'envoi du rapport.")]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-medium text-zinc-900">{t("Laboratoire")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("Demandes d'examens reçues et saisie des résultats")}</p>
      </div>
      <ServiceSummary load={getLabSummary} doneLabel={t("Résultats du jour")} />
      <div className="flex gap-1 border-b border-zinc-200">
        {(["pending", "done"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-3 py-2 text-sm transition ${
              activeTab === tab
                ? "border-[#1A6FD4] font-medium text-[#1A6FD4]"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {tab === "pending" ? t("Examens en cours") : t("Résultats envoyés")}
          </button>
        ))}
      </div>
      {activeTab === "done" && <CompletedRequests load={loadCompleted} emptyLabel={t("Aucun résultat envoyé pour le moment.")} />}
      <div className={`flex flex-1 min-h-[560px] gap-4 overflow-hidden font-sans ${activeTab === "done" ? "hidden" : ""}`}>
        <div className="w-[40%] flex flex-col overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white">
          <div className="p-5 border-b border-zinc-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-900 flex items-center gap-3">
              <FlaskConical className="w-4 h-4" /> {t("Demandes en attente")} ({requests.length})
            </h2>
            <button
              type="button"
              onClick={loadQueue}
              disabled={isLoadingQueue}
              className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingQueue ? "animate-spin" : ""}`} /> {t("Actualiser")}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingQueue && (
              <p className="p-6 text-sm text-zinc-400">{t("Chargement...")}</p>
            )}
            {queueError && (
              <p className="p-6 text-sm text-red-600">{queueError}</p>
            )}
            {!isLoadingQueue && !queueError && requests.length === 0 && (
              <p className="p-6 text-sm text-zinc-400">
                {t("Aucune demande en attente.")}
              </p>
            )}

            {requests.map((request) => (
              <button
                key={request.id}
                onClick={() => selectRequest(request)}
                className={`w-full p-6 text-left border-b border-zinc-50 transition-all ${
                  selected?.id === request.id ? "bg-zinc-100/50" : "hover:bg-zinc-50"
                }`}
              >
                <h3 className="text-sm font-medium text-zinc-900">
                  {request.urgent && (
                    <span data-testid="lab-urgent" className="mr-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                      {t("Urgent")}
                    </span>
                  )}
                  {request.patientName || t("Patient inconnu")} —{" "}
                  <span className="text-xs">{request.exam ?? t("Examen non précisé")}</span>
                </h3>
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-400 mt-2">
                  <User className="w-3 h-3" /> {request.requester ?? t("Demandeur inconnu")}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto rounded-[18px] border border-zinc-200/70 bg-white">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30">
              <FlaskConical className="w-16 h-16 mb-6" />
              <p className="text-sm font-medium">{t("Sélectionner une demande")}</p>
            </div>
          ) : submitted ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium text-zinc-900 mb-2">{t("Résultats envoyés")}</h3>
              <p className="text-sm text-zinc-500">
                {t("{name} sera notifié via le dossier patient.", { name: selected.requester ?? t("Le médecin") })}
              </p>
              <button
                onClick={() => setSelected(null)}
                className="mt-10 px-8 py-3 bg-[#1A6FD4] text-white text-sm font-medium hover:bg-[#155bb0] transition-all rounded-full"
              >
                {t("Demande suivante")}
              </button>
            </div>
          ) : (
            <>
              <div className="p-8 border-b border-zinc-100">
                <h2 className="text-sm font-medium text-zinc-900 mb-6">
                  {t("Saisie résultats")} — {selected.patientName} — {selected.exam}
                </h2>
                <div className="flex items-center gap-8 bg-zinc-50 p-4 border border-zinc-200/70 rounded-[18px]">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-400 mb-0.5">
                      {t("ID Patient")}
                    </span>
                    <span className="text-xs font-medium text-zinc-900">{selected.patientId}</span>
                  </div>
                  <div className="w-px h-8 bg-zinc-200"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-400 mb-0.5">
                      {t("Demandeur")}
                    </span>
                    <span className="text-xs font-medium text-zinc-900">{selected.requester}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-8 flex-1 space-y-8">
                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-6 space-y-2 rounded-[18px]">
                    {errors.map((message) => (
                      <p key={message} className="text-xs font-medium text-red-700">
                        {message}
                      </p>
                    ))}
                  </div>
                )}

                <div className="border border-zinc-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-white border-b border-zinc-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-medium text-zinc-400">
                          {t("Paramètre")}
                        </th>
                        <th className="px-6 py-4 text-xs font-medium text-zinc-400">
                          {t("Valeur")}
                        </th>
                        <th className="px-3 py-4 text-xs font-medium text-zinc-400">{t("Unité")}</th>
                        <th className="px-3 py-4 text-xs font-medium text-zinc-400">{t("Réf. basse")}</th>
                        <th className="px-3 py-4 text-xs font-medium text-zinc-400">{t("Réf. haute")}</th>
                        <th className="px-3 py-4 text-xs font-medium text-zinc-400">{t("Résultat")}</th>
                        <th className="px-6 py-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {results.map((row, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              data-testid="lab-result-label-input"
                              value={row.label}
                              onChange={(event) => updateResultRow(index, "label", event.target.value)}
                              placeholder={t("Ex. : Hémoglobine")}
                              className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#1A6FD4] rounded-xl"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              data-testid="lab-result-value-input"
                              value={row.value}
                              onChange={(event) => updateResultRow(index, "value", event.target.value)}
                              placeholder={t("Ex. : 8.2 g/dL")}
                              className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#1A6FD4] rounded-xl"
                            />
                          </td>
                          {(["unit", "referenceLow", "referenceHigh"] as const).map((field) => (
                            <td key={field} className="px-3 py-4">
                              <input
                                type="text"
                                data-testid={`lab-result-${field}-input`}
                                value={row[field] ?? ""}
                                onChange={(event) => updateResultRow(index, field, event.target.value)}
                                className="w-20 bg-zinc-50 border border-zinc-200 px-2 py-2 text-xs focus:outline-none focus:border-[#1A6FD4] rounded-xl"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-4">
                            {(() => {
                              const flag = flagFor(row);
                              return flag ? (
                                <span className={`text-xs font-medium border px-2 py-1 rounded-xl ${FLAG_STYLE[flag].className}`}>
                                  {t(FLAG_STYLE[flag].label)}
                                </span>
                              ) : null;
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {results.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeResultRow(index)}
                                className="text-zinc-300 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={() => setResults((rows) => [...rows, EMPTY_ROW])}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-zinc-500 hover:bg-zinc-50 border-t border-zinc-100 transition-all"
                  >
                    <Plus className="w-3 h-3" /> {t("Ajouter un paramètre")}
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">
                    {t("Conclusion (optionnel)")}
                  </label>
                  <textarea
                    value={conclusion}
                    onChange={(event) => setConclusion(event.target.value)}
                    rows={3}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs resize-none rounded-xl"
                    placeholder={t("Interprétation, recommandation...")}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#1A6FD4] text-white px-10 py-4 text-xs font-medium hover:bg-[#1559ab] transition-all disabled:opacity-50 flex items-center gap-3 rounded-full"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isSubmitting ? t("Envoi...") : t("Valider et envoyer")}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
