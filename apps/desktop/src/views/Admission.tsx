import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { ApiError, createPatient } from "../lib/api";
import type { Gender, Patient } from "../lib/types";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  birthDate: "",
  gender: "female" as Gender,
  guardianName: "",
  guardianRelationship: "",
  guardianPhone: "",
};

export default function Admission() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [createdPatient, setCreatedPatient] = useState<Patient | null>(null);

  function updateField<K extends keyof typeof EMPTY_FORM>(field: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      const patient = await createPatient({
        firstName: form.firstName,
        lastName: form.lastName,
        birthDate: form.birthDate,
        gender: form.gender,
        guardian: {
          name: form.guardianName,
          relationship: form.guardianRelationship,
          phone: form.guardianPhone,
        },
      });
      setCreatedPatient(patient);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors(["Erreur inattendue lors de la création du dossier."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdPatient) {
    return (
      <div className="p-10 max-w-xl mx-auto space-y-8">
        <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-green-500 p-8 flex flex-col items-center text-white space-y-4">
            <CheckCircle2 className="w-16 h-16" />
            <div className="text-center">
              <h2 className="text-xl font-black uppercase tracking-[0.2em]">Dossier créé</h2>
              <p className="text-xs font-mono font-bold opacity-80 uppercase tracking-widest">
                Référence : {createdPatient.id}
              </p>
            </div>
          </div>

          <div className="p-10 space-y-6 text-center">
            <p className="text-sm font-black text-zinc-900">
              {createdPatient.firstName.toUpperCase()} {createdPatient.lastName.toUpperCase()}
            </p>
            <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
              Né(e) le {createdPatient.birthDate}
            </p>

            <button
              type="button"
              onClick={() => {
                setCreatedPatient(null);
                setForm(EMPTY_FORM);
              }}
              className="w-full bg-zinc-900 text-white px-6 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
            >
              Nouvelle admission
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-5xl mx-auto space-y-10">
      <div className="border-b border-zinc-200 pb-10">
        <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-[0.2em] mb-3">Admission</h1>
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
          Enregistrement d'un nouveau patient — Service Pédiatrie
        </p>
      </div>

      <form className="space-y-10 pb-20" onSubmit={handleSubmit}>
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-6 space-y-2">
            {errors.map((message) => (
              <p key={message} className="text-xs font-bold text-red-700">
                {message}
              </p>
            ))}
          </div>
        )}

        <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">Identité de l'enfant</h2>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Prénom</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs uppercase"
                placeholder="AMINA"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs uppercase"
                placeholder="OSEI"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Date de naissance
              </label>
              <input
                type="date"
                required
                value={form.birthDate}
                onChange={(event) => updateField("birthDate", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all font-mono text-[10px]"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sexe</label>
              <select
                value={form.gender}
                onChange={(event) => updateField("gender", event.target.value as Gender)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all appearance-none cursor-pointer text-[10px] font-mono tracking-widest"
              >
                <option value="female">FÉMININ</option>
                <option value="male">MASCULIN</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">Contact du tuteur</h2>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Nom complet du tuteur
              </label>
              <input
                type="text"
                required
                value={form.guardianName}
                onChange={(event) => updateField("guardianName", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs uppercase"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Relation</label>
              <select
                value={form.guardianRelationship}
                onChange={(event) => updateField("guardianRelationship", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all appearance-none cursor-pointer text-[10px] font-mono tracking-widest"
              >
                <option value="">CHOISIR</option>
                <option value="Mère">MÈRE</option>
                <option value="Père">PÈRE</option>
                <option value="Tuteur légal">TUTEUR LÉGAL</option>
                <option value="Autre">AUTRE</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Téléphone</label>
              <input
                type="tel"
                required
                value={form.guardianPhone}
                onChange={(event) => updateField("guardianPhone", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all font-mono text-[10px] tracking-widest"
                placeholder="+221_XX_XXX_XX_XX"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-10 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Création en cours..." : "Valider l'admission"}
          </button>
        </div>
      </form>
    </div>
  );
}
