import { Printer } from "lucide-react";
import { PrescriptionSheet } from "../../components/print/PrintSheets";
import { usePrint } from "../../lib/print";
import { useI18n } from "../../lib/i18n";
import type { Patient, Prescription } from "../../lib/types";

export default function PrescriptionsHistory({ prescriptions, patient }: { prescriptions: Prescription[]; patient: Patient }) {
  const { t, formatDateTime } = useI18n();
  const { printDocument } = usePrint();
  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100 flex items-center justify-between">
        <h2 className="text-sm font-medium">{t("Prescriptions")}</h2>
        {prescriptions.length > 0 && (
          <button
            type="button"
            data-testid="print-prescriptions"
            onClick={() => printDocument((facility) => <PrescriptionSheet facility={facility} patient={patient} prescriptions={prescriptions} />)}
            className="flex items-center gap-2 text-xs font-medium text-[#1A6FD4] hover:underline"
          >
            <Printer className="h-3.5 w-3.5" /> {t("Imprimer l'ordonnance")}
          </button>
        )}
      </div>

      {prescriptions.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">
          {t("Aucune prescription enregistrée.")}
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {prescriptions.map((prescription) => (
            <div key={prescription.id} className="p-8 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-900">
                  {prescription.medication ?? t("Médicament non précisé")}
                </p>
                <span className="text-sm text-zinc-400">
                  {prescription.date ? formatDateTime(prescription.date) : t("Date inconnue")}
                </span>
              </div>
              {prescription.dosage && <p className="text-xs text-zinc-600">{prescription.dosage}</p>}
              {prescription.allergyOverrideConfirmed && (
                <p className="text-sm font-medium text-amber-700">
                  {t("Confirmée malgré une allergie connue")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
