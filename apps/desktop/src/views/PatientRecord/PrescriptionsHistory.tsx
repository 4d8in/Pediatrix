import type { Prescription } from "../../lib/types";

export default function PrescriptionsHistory({ prescriptions }: { prescriptions: Prescription[] }) {
  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">Prescriptions</h2>
      </div>

      {prescriptions.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">
          Aucune prescription enregistrée.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {prescriptions.map((prescription) => (
            <div key={prescription.id} className="p-8 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-900">
                  {prescription.medication ?? "Médicament non précisé"}
                </p>
                <span className="text-sm text-zinc-400">
                  {prescription.date ? new Date(prescription.date).toLocaleString("fr-FR") : "Date inconnue"}
                </span>
              </div>
              {prescription.dosage && <p className="text-xs text-zinc-600">{prescription.dosage}</p>}
              {prescription.allergyOverrideConfirmed && (
                <p className="text-sm font-medium text-amber-700">
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
