import type { Consultation } from "../../lib/types";
import ConsultationHistoryItem from "./ConsultationHistoryItem";

export default function ConsultationHistory({ consultations }: { consultations: Consultation[] }) {
  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">Historique des consultations</h2>
      </div>

      {consultations.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">
          Aucune consultation enregistrée.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {consultations.map((consultation) => (
            <ConsultationHistoryItem key={consultation.id} consultation={consultation} />
          ))}
        </div>
      )}
    </section>
  );
}
