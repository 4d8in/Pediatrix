import type { Consultation } from "../../lib/types";

const VITAL_LABELS: { key: keyof Consultation["vitals"]; label: string; unit: string }[] = [
  { key: "temperature", label: "Température", unit: "°C" },
  { key: "weight", label: "Poids", unit: "kg" },
  { key: "height", label: "Taille", unit: "cm" },
  { key: "heartRate", label: "FC", unit: "/min" },
  { key: "respiratoryRate", label: "FR", unit: "/min" },
];

export default function ConsultationHistoryItem({ consultation }: { consultation: Consultation }) {
  const vitalsPresent = VITAL_LABELS.filter((vital) => consultation.vitals[vital.key] !== undefined);

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-tight text-zinc-900">
          {consultation.reason ?? "Motif non renseigné"}
        </p>
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
          {consultation.date ? new Date(consultation.date).toLocaleString("fr-FR") : "Date inconnue"}
        </span>
      </div>

      {consultation.notes && <p className="text-xs text-zinc-600">{consultation.notes}</p>}

      {vitalsPresent.length > 0 && (
        <div className="flex flex-wrap gap-4 pt-2">
          {vitalsPresent.map((vital) => (
            <span
              key={vital.key}
              className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50 border border-zinc-200 px-3 py-1"
            >
              {vital.label}: {consultation.vitals[vital.key]} {vital.unit}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
