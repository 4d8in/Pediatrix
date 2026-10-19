import { Printer } from "lucide-react";
import { ReferralSheet } from "../../components/print/PrintSheets";
import { usePrint } from "../../lib/print";
import { useI18n } from "../../lib/i18n";
import type { Diagnosis, Patient, Referral } from "../../lib/types";

export default function ReferralsSection({
  referrals,
  diagnoses,
  patient,
}: {
  referrals: Referral[];
  diagnoses: Diagnosis[];
  patient: Patient;
}) {
  const { t, formatDate } = useI18n();
  const { printDocument } = usePrint();
  if (referrals.length === 0) return null;

  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">{t("Références vers d'autres structures")}</h2>
      </div>
      <ul className="divide-y divide-zinc-100">
        {referrals.map((referral) => (
          <li key={referral.id} className="flex items-center justify-between gap-4 px-8 py-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {referral.destination}
                {referral.urgent && <span className="ml-2 text-xs font-medium text-red-700">{t("Urgent")}</span>}
              </p>
              <p className="text-xs text-zinc-500">
                {referral.reason} · {referral.date ? formatDate(referral.date) : ""}
              </p>
            </div>
            <button
              type="button"
              data-testid="print-referral"
              onClick={() =>
                printDocument((facility) => (
                  <ReferralSheet
                    facility={facility}
                    patient={patient}
                    referral={referral}
                    diagnoses={diagnoses.filter((d) => d.encounterId === referral.encounterId)}
                  />
                ))
              }
              className="flex items-center gap-2 text-xs font-medium text-[#1A6FD4] hover:underline"
            >
              <Printer className="h-3.5 w-3.5" /> {t("Imprimer la fiche")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
