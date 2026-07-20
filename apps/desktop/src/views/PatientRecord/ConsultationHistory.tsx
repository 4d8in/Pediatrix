import type { Consultation } from "../../lib/types";
import ConsultationHistoryItem from "./ConsultationHistoryItem";

export default function ConsultationHistory({ consultations }: { consultations: Consultation[] }) {
  return (
    <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">Historique des consultations</h2>
      </div>

      {consultations.length === 0 ? (
        <p className="p-10 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
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
