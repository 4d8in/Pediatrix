import type { Patient } from "../../lib/types";

const GENDER_LABELS: Record<Patient["gender"], string> = {
  male: "Masculin",
  female: "Féminin",
  other: "Autre",
  unknown: "Inconnu",
};

export default function PatientIdentity({ patient }: { patient: Patient }) {
  return (
    <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">Identité</h2>
      </div>
      <div className="p-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom</p>
          <p className="text-sm font-bold text-zinc-900 mt-1">
            {patient.firstName} {patient.lastName}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Né(e) le</p>
          <p className="text-sm font-bold text-zinc-900 mt-1">{patient.birthDate}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sexe</p>
          <p className="text-sm font-bold text-zinc-900 mt-1">{GENDER_LABELS[patient.gender]}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Référence</p>
          <p className="text-sm font-mono font-bold text-zinc-900 mt-1">{patient.id}</p>
        </div>

        {patient.guardian && (
          <>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tuteur</p>
              <p className="text-sm font-bold text-zinc-900 mt-1">{patient.guardian.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Relation</p>
              <p className="text-sm font-bold text-zinc-900 mt-1">{patient.guardian.relationship}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Téléphone</p>
              <p className="text-sm font-bold text-zinc-900 mt-1">{patient.guardian.phone}</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
