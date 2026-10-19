import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Hourglass } from "lucide-react";
import type { RequestSummary } from "../lib/types";
import { useI18n } from "../lib/i18n";

function formatDelay(hours: number | null, t: (fr: string, vars?: Record<string, string | number>) => string): string {
  if (hours === null) return "—";
  return hours < 24 ? t("{n} h", { n: hours }) : t("{n} j", { n: Math.round((hours / 24) * 10) / 10 });
}

// Compteurs du jour d'un service prestataire (Laboratoire, Radiologie).
export default function ServiceSummary({ load, doneLabel }: { load: () => Promise<RequestSummary>; doneLabel: string }) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<RequestSummary | null>(null);

  useEffect(() => {
    load().then(setSummary).catch(() => undefined);
  }, [load]);

  const tiles = [
    { label: t("En attente"), value: summary ? String(summary.enAttente) : "…", icon: Hourglass, caption: t("Demandes à traiter") },
    { label: doneLabel, value: summary ? String(summary.rendusAujourdhui) : "…", icon: CheckCircle2, caption: t("Envoyés aujourd'hui") },
    {
      label: t("Délai moyen"),
      value: summary ? formatDelay(summary.delaiMoyenHeures, t) : "…",
      icon: Clock,
      caption: t("Entre la demande et le résultat (30 derniers jours)"),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="flex items-center gap-4 rounded-[18px] border border-zinc-200/70 bg-white p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1A6FD4]/10 text-[#1A6FD4]">
            <tile.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">{tile.label}</p>
            <p className="text-[22px] font-medium text-zinc-900">{tile.value}</p>
            <p className="text-xs text-zinc-400">{tile.caption}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
