import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

interface CompletedRequest {
  id: string;
  patientName: string;
  exam: string | null;
  requester: string | null;
  authoredOn: string | null;
}

interface CompletedRequestsProps {
  load: () => Promise<{ requests: CompletedRequest[] }>;
  emptyLabel: string;
}

// Historique des demandes déjà traitées (résultats ou comptes-rendus envoyés),
// partagé par les pages Laboratoire et Radiologie.
export default function CompletedRequests({ load, emptyLabel }: CompletedRequestsProps) {
  const { t, formatDate } = useI18n();
  const [requests, setRequests] = useState<CompletedRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setRequests(data.requests);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("Le serveur Pédiatrix est injoignable."));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  return (
    <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-3 font-normal">{t("Patient")}</th>
            <th className="py-3 font-normal">{t("Examen")}</th>
            <th className="py-3 font-normal">{t("Demandeur")}</th>
            <th className="py-3 font-normal">{t("Demandé le")}</th>
            <th className="py-3 font-normal">{t("Statut")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {isLoading && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-zinc-400">
                {t("Chargement…")}
              </td>
            </tr>
          )}
          {!isLoading && requests.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-zinc-400">
                {emptyLabel}
              </td>
            </tr>
          )}
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="py-3 text-zinc-900">{request.patientName || "—"}</td>
              <td className="py-3 text-zinc-700">{request.exam ?? "—"}</td>
              <td className="py-3 text-zinc-700">{request.requester ?? "—"}</td>
              <td className="py-3 text-zinc-700">
                {request.authoredOn ? formatDate(request.authoredOn) : "—"}
              </td>
              <td className="py-3">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">{t("Terminé")}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
