import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Plus, RefreshCw, ScanLine, Trash2, User } from "lucide-react";
import CompletedRequests from "../components/CompletedRequests";
import ServiceSummary from "../components/ServiceSummary";
import { ApiError, getImagingSummary, createImagingReport, listImagingRequests } from "../lib/api";
import type { ImagingRequest, LabResultInput } from "../lib/types";

const EMPTY_ROW: LabResultInput = { label: "", value: "" };

// Même besoin de rafraîchissement automatique que Laboratory.tsx (voir ce
// fichier) : la file peut rester momentanément périmée juste après la demande.
const AUTO_REFRESH_INTERVAL_MS = 15_000;

export default function Radiology() {
  const [activeTab, setActiveTab] = useState<"pending" | "done">("pending");
  const loadCompleted = useCallback(() => listImagingRequests("completed"), []);
  const [requests, setRequests] = useState<ImagingRequest[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ImagingRequest | null>(null);

  const [results, setResults] = useState<LabResultInput[]>([EMPTY_ROW]);
  const [conclusion, setConclusion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function loadQueue() {
    setIsLoadingQueue(true);
    setQueueError(null);
    listImagingRequests()
      .then((data) => setRequests(data.requests))
      .catch((err) => setQueueError(err instanceof ApiError ? err.message : "Erreur de chargement de la file."))
      .finally(() => setIsLoadingQueue(false));
  }

  useEffect(() => {
    loadQueue();
    const intervalId = setInterval(loadQueue, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  function selectRequest(request: ImagingRequest) {
    setSelected(request);
    setResults([EMPTY_ROW]);
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
      await createImagingReport(selected.id, { results, conclusion: conclusion || undefined });
      setSubmitted(true);
      setRequests((rows) => rows.filter((row) => row.id !== selected.id));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors(["Erreur inattendue lors de l'envoi du compte-rendu."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-medium text-zinc-900">Radiologie</h1>
        <p className="mt-1 text-sm text-zinc-500">Demandes d'imagerie reçues et comptes-rendus</p>
      </div>
      <ServiceSummary load={getImagingSummary} doneLabel="Comptes-rendus du jour" />
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
            {tab === "pending" ? "Demandes en cours" : "Comptes-rendus envoyés"}
          </button>
        ))}
      </div>
      {activeTab === "done" && <CompletedRequests load={loadCompleted} emptyLabel="Aucun compte-rendu envoyé pour le moment." />}
      <div className={`flex flex-1 min-h-[560px] gap-4 overflow-hidden font-sans ${activeTab === "done" ? "hidden" : ""}`}>
        <div className="w-[40%] flex flex-col overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white">
          <div className="p-5 border-b border-zinc-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-900 flex items-center gap-3">
              <ScanLine className="w-4 h-4" /> Demandes en attente ({requests.length})
            </h2>
            <button
              type="button"
              onClick={loadQueue}
              disabled={isLoadingQueue}
              className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingQueue ? "animate-spin" : ""}`} /> Actualiser
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingQueue && (
              <p className="p-6 text-sm text-zinc-400">Chargement...</p>
            )}
            {queueError && (
              <p className="p-6 text-sm text-red-600">{queueError}</p>
            )}
            {!isLoadingQueue && !queueError && requests.length === 0 && (
              <p className="p-6 text-sm text-zinc-400">
                Aucune demande en attente.
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
                  {request.patientName || "Patient inconnu"} —{" "}
                  <span className="text-xs">{request.exam ?? "Examen non précisé"}</span>
                </h3>
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-400 mt-2">
                  <User className="w-3 h-3" /> {request.requester ?? "Demandeur inconnu"}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto rounded-[18px] border border-zinc-200/70 bg-white">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30">
              <ScanLine className="w-16 h-16 mb-6" />
              <p className="text-sm font-medium">Sélectionner une demande</p>
            </div>
          ) : submitted ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium text-zinc-900 mb-2">
                Compte-rendu envoyé
              </h3>
              <p className="text-sm text-zinc-500">
                {selected.requester ?? "Le médecin"} sera notifié via le dossier patient.
              </p>
              <button
                onClick={() => setSelected(null)}
                className="mt-10 px-8 py-3 bg-[#1A6FD4] text-white text-sm font-medium hover:bg-[#155bb0] transition-all rounded-full"
              >
                Demande suivante
              </button>
            </div>
          ) : (
            <>
              <div className="p-8 border-b border-zinc-100">
                <h2 className="text-sm font-medium text-zinc-900 mb-6">
                  Compte-rendu — {selected.patientName} — {selected.exam}
                </h2>
                <div className="flex items-center gap-8 bg-zinc-50 p-4 border border-zinc-200/70 rounded-[18px]">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-400 mb-0.5">
                      ID Patient
                    </span>
                    <span className="text-xs font-medium text-zinc-900">{selected.patientId}</span>
                  </div>
                  <div className="w-px h-8 bg-zinc-200"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-400 mb-0.5">
                      Demandeur
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
                          Zone examinée
                        </th>
                        <th className="px-6 py-4 text-xs font-medium text-zinc-400">
                          Constatation
                        </th>
                        <th className="px-6 py-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {results.map((row, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={row.label}
                              onChange={(event) => updateResultRow(index, "label", event.target.value)}
                              placeholder="Ex. : Poumons"
                              className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#1A6FD4] rounded-xl"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={row.value}
                              onChange={(event) => updateResultRow(index, "value", event.target.value)}
                              placeholder="Ex. : Sans anomalie"
                              className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#1A6FD4] rounded-xl"
                            />
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
                    <Plus className="w-3 h-3" /> Ajouter une observation
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">
                    Conclusion (optionnel)
                  </label>
                  <textarea
                    value={conclusion}
                    onChange={(event) => setConclusion(event.target.value)}
                    rows={3}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs resize-none rounded-xl"
                    placeholder="Interprétation, recommandation..."
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#1A6FD4] text-white px-10 py-4 text-xs font-medium hover:bg-[#1559ab] transition-all disabled:opacity-50 flex items-center gap-3 rounded-full"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isSubmitting ? "Envoi..." : "Valider et envoyer"}
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
