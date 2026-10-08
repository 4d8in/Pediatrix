import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCcw, WifiOff } from "lucide-react";
import { getHealth } from "../lib/api";

const CHECK_INTERVAL_MS = 15_000;

// Bandeau affiché quand le serveur Pédiatrix (ou HAPI derrière lui) ne répond
// plus. Vérifie régulièrement GET /api/health ; au retour de la connexion, ou
// sur « Réessayer », demande au parent de recharger l'écran courant.
export default function ConnectionBanner({ onReconnect }: { onReconnect: () => void }) {
  const [problem, setProblem] = useState<"backend" | "hapi" | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const wasDown = useRef(false);

  const check = useCallback(async () => {
    setIsChecking(true);
    try {
      const health = await getHealth();
      const next = health.hapi.status === "up" ? null : "hapi";
      setProblem(next);
      if (!next && wasDown.current) onReconnect();
      wasDown.current = next !== null;
    } catch {
      setProblem("backend");
      wasDown.current = true;
    } finally {
      setIsChecking(false);
    }
  }, [onReconnect]);

  useEffect(() => {
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [check]);

  if (!problem) return null;

  return (
    <div role="alert" className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-6 py-2.5 text-sm text-red-800">
      <WifiOff className="h-4 w-4 shrink-0" />
      <p className="flex-1">
        {problem === "backend"
          ? "Serveur Pédiatrix injoignable : vérifiez que le poste est bien connecté au réseau de l'hôpital."
          : "Le serveur de dossiers (HAPI FHIR) ne répond pas : les données peuvent être incomplètes."}{" "}
        Nouvelle tentative automatique toutes les 15 secondes.
      </p>
      <button
        onClick={() => {
          check();
          onReconnect();
        }}
        disabled={isChecking}
        className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
      >
        <RefreshCcw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} /> Réessayer
      </button>
    </div>
  );
}
