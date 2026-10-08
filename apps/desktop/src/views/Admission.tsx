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
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
          <div className="bg-green-500 p-8 flex flex-col items-center text-white space-y-4">
            <CheckCircle2 className="w-16 h-16" />
            <div className="text-center">
              <h2 className="text-xl font-medium">Dossier créé</h2>
              <p className="text-xs font-medium opacity-80">
                Référence : {createdPatient.id}
              </p>
            </div>
          </div>

          <div className="p-10 space-y-6 text-center">
            <p className="text-sm font-medium text-zinc-900">
              {createdPatient.firstName.toUpperCase()} {createdPatient.lastName.toUpperCase()}
            </p>
            <p className="text-sm font-medium text-zinc-400">
              Né(e) le {createdPatient.birthDate}
            </p>

            <button
              type="button"
              onClick={() => {
                setCreatedPatient(null);
                setForm(EMPTY_FORM);
              }}
              className="w-full bg-[#1A6FD4] text-white px-6 py-4 text-sm font-medium hover:bg-[#155bb0] transition-all rounded-full"
            >
              Nouvelle admission
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="pb-2">
        <h1 className="text-[22px] font-medium text-zinc-900 mb-1">Admission</h1>
        <p className="text-sm text-zinc-400 font-medium">
          Enregistrement d'un nouveau patient — Service Pédiatrie
        </p>
      </div>

      <form className="space-y-10 pb-20" onSubmit={handleSubmit}>
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-6 space-y-2 rounded-[18px]">
            {errors.map((message) => (
              <p key={message} className="text-xs font-medium text-red-700">
                {message}
              </p>
            ))}
          </div>
        )}

        <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
          <div className="bg-white px-8 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-medium">Identité de l'enfant</h2>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Prénom</label>
              <input
                type="text"
                required
                data-testid="admission-first-name"
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all font-medium text-xs rounded-xl"
                placeholder="Amina"
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Nom</label>
              <input
                type="text"
                required
                data-testid="admission-last-name"
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all font-medium text-xs rounded-xl"
                placeholder="Osei"
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">
                Date de naissance
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                data-testid="admission-birth-date"
                pattern="\d{4}-\d{2}-\d{2}"
                title="Format AAAA-MM-JJ"
                placeholder="AAAA-MM-JJ"
                value={form.birthDate}
                onChange={(event) => updateField("birthDate", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-sm rounded-xl"
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Sexe</label>
              <select
                data-testid="admission-gender"
                value={form.gender}
                onChange={(event) => updateField("gender", event.target.value as Gender)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all appearance-none cursor-pointer text-sm rounded-xl"
              >
                <option value="female">Féminin</option>
                <option value="male">Masculin</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
          <div className="bg-white px-8 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-medium">Contact du tuteur</h2>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">
                Nom complet du tuteur
              </label>
              <input
                type="text"
                required
                data-testid="admission-guardian-name"
                value={form.guardianName}
                onChange={(event) => updateField("guardianName", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all font-medium text-xs rounded-xl"
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Relation</label>
              <select
                data-testid="admission-guardian-relationship"
                value={form.guardianRelationship}
                onChange={(event) => updateField("guardianRelationship", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all appearance-none cursor-pointer text-sm rounded-xl"
              >
                <option value="">Choisir</option>
                <option value="Mère">Mère</option>
                <option value="Père">Père</option>
                <option value="Tuteur légal">Tuteur légal</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Téléphone</label>
              <input
                type="tel"
                required
                data-testid="admission-guardian-phone"
                value={form.guardianPhone}
                onChange={(event) => updateField("guardianPhone", event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-sm rounded-xl"
                placeholder="+221 XX XXX XX XX"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="admission-submit"
            className="px-10 py-3 bg-[#1A6FD4] text-white text-sm font-medium hover:bg-[#155bb0] transition-all disabled:opacity-50 rounded-full"
          >
            {isSubmitting ? "Création en cours..." : "Valider l'admission"}
          </button>
        </div>
      </form>
    </div>
  );
}
