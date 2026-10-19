import { useEffect, useState } from "react";
import { Download, RotateCw } from "lucide-react";
import type { UpdateStatus } from "../lib/update-status";
import { useI18n } from "../lib/i18n";

// Bandeau de mise à jour, visible uniquement dans l'application Electron
// (window.pediatrixUpdater est exposé par electron/preload.ts ; absent en web).
export default function UpdateBanner() {
  const { t } = useI18n();
  const updater = window.pediatrixUpdater;
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });

  useEffect(() => {
    if (!updater) return;
    void updater.getStatus().then(setStatus);
    return updater.onStatus(setStatus);
  }, [updater]);

  if (status.state === "downloading") {
    return (
      <div className="flex items-center gap-3 px-10 py-2 bg-blue-50 border-b border-blue-100 text-[#1A6FD4]">
        <Download className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium">
          {t("Téléchargement de la mise à jour {version} — {percent} %", { version: status.version, percent: status.percent })}
        </span>
      </div>
    );
  }

  if (status.state === "ready") {
    return (
      <div className="flex items-center justify-between gap-3 px-10 py-2 bg-emerald-50 border-b border-emerald-100 text-emerald-700">
        <span className="text-sm font-medium">
          {t("Mise à jour {version} prête — elle sera installée à la fermeture", { version: status.version })}
        </span>
        <button
          onClick={() => void updater?.installNow()}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-emerald-700"
        >
          <RotateCw className="w-3 h-3" /> {t("Redémarrer maintenant")}
        </button>
      </div>
    );
  }

  return null;
}
