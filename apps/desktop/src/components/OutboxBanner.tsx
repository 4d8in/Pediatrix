import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCcw, X } from "lucide-react";
import { classifyReplayError, sendQueued } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { dismissFailed, replayOutbox, useOutbox } from "../lib/outbox";

const RETRY_INTERVAL_MS = 15_000;

// Saisies gardées sur le poste faute de connexion au serveur : on les montre tant qu'elles ne sont
// pas parties, on les renvoie automatiquement (et sur « Envoyer maintenant »), et on affiche à part
// celles que le serveur a refusées pour que rien ne se perde en silence.
export default function OutboxBanner({ onSent }: { onSent: () => void }) {
  const { t, formatDateTime } = useI18n();
  const { mine, failed, persistent } = useOutbox();
  const [isSending, setIsSending] = useState(false);

  const flush = useCallback(async () => {
    setIsSending(true);
    try {
      const { sent } = await replayOutbox(sendQueued, classifyReplayError);
      if (sent > 0) onSent();
    } finally {
      setIsSending(false);
    }
  }, [onSent]);

  const pending = mine.length;
  useEffect(() => {
    if (pending === 0) return;
    void flush();
    const id = setInterval(() => void flush(), RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pending, flush]);

  if (pending === 0 && failed.length === 0) return null;

  return (
    <div data-testid="outbox-banner" className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm text-amber-900">
      {pending > 0 && (
        <div className="flex items-center gap-3">
          <CloudOff className="h-4 w-4 shrink-0" />
          <p className="flex-1">
            <span data-testid="outbox-count">{t("{n} saisie(s) enregistrée(s) sur ce poste, en attente d'envoi au serveur.", { n: pending })}</span>{" "}
            {!persistent && t("Attention : elles ne sont conservées qu'en mémoire, ne fermez pas l'application.")}
          </p>
          <button
            onClick={() => void flush()}
            disabled={isSending}
            data-testid="outbox-flush"
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1 text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isSending ? "animate-spin" : ""}`} /> {t("Envoyer maintenant")}
          </button>
        </div>
      )}
      {pending > 0 && (
        <ul className="mt-1 list-disc pl-10 text-xs text-amber-800">
          {mine.map((item) => (
            <li key={item.id}>
              {t(item.label)} — {formatDateTime(item.createdAt)}
            </li>
          ))}
        </ul>
      )}
      {failed.map((item) => (
        <div key={item.id} data-testid="outbox-failed" className="mt-1 flex items-center gap-3 text-red-800">
          <p className="flex-1">
            {t("Refusé par le serveur, à vérifier :")} {t(item.label)} ({formatDateTime(item.createdAt)}) — {item.error}
          </p>
          <button onClick={() => dismissFailed(item.id)} aria-label={t("Ignorer")} className="rounded p-1 hover:bg-red-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
