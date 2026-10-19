import type { Patient } from "../../lib/types";
import { useI18n } from "../../lib/i18n";

const GENDER_LABELS: Record<Patient["gender"], string> = {
  male: "Masculin",
  female: "Féminin",
  other: "Autre",
  unknown: "Inconnu",
};

export default function PatientIdentity({ patient }: { patient: Patient }) {
  const { t } = useI18n();
  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">{t("Identité")}</h2>
      </div>
      <div className="p-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <p className="text-sm font-medium text-zinc-400">{t("Nom")}</p>
          <p className="text-sm font-medium text-zinc-900 mt-1">
            {patient.firstName} {patient.lastName}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-400">{t("Né(e) le")}</p>
          <p className="text-sm font-medium text-zinc-900 mt-1">{patient.birthDate}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-400">{t("Sexe")}</p>
          <p className="text-sm font-medium text-zinc-900 mt-1">{t(GENDER_LABELS[patient.gender])}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-400">{t("N° de dossier")}</p>
          <p className="text-sm font-medium text-zinc-900 mt-1">{patient.mrn}</p>
        </div>

        {patient.guardian && (
          <>
            <div>
              <p className="text-sm font-medium text-zinc-400">{t("Tuteur")}</p>
              <p className="text-sm font-medium text-zinc-900 mt-1">{patient.guardian.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">{t("Relation")}</p>
              <p className="text-sm font-medium text-zinc-900 mt-1">{patient.guardian.relationship}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">{t("Téléphone")}</p>
              <p className="text-sm font-medium text-zinc-900 mt-1">{patient.guardian.phone}</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
