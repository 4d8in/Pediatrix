import type { Prescription } from "../../lib/types";

export default function PrescriptionsHistory({ prescriptions }: { prescriptions: Prescription[] }) {
  return (
    <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">Prescriptions</h2>
      </div>

      {prescriptions.length === 0 ? (
        <p className="p-10 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
          Aucune prescription enregistrée.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {prescriptions.map((prescription) => (
            <div key={prescription.id} className="p-8 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-tight text-zinc-900">
                  {prescription.medication ?? "Médicament non précisé"}
                </p>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                  {prescription.date ? new Date(prescription.date).toLocaleString("fr-FR") : "Date inconnue"}
                </span>
              </div>
              {prescription.dosage && <p className="text-xs text-zinc-600">{prescription.dosage}</p>}
              {prescription.allergyOverrideConfirmed && (
                <p className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-widest">
                  Confirmée malgré une allergie connue
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
