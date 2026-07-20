import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import PatientPicker from "../components/PatientPicker";
import VitalsFields from "./VitalsFields";
import { ApiError, createEncounter } from "../lib/api";
import type { Patient, Vitals } from "../lib/types";

export default function Consultations() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [vitals, setVitals] = useState<Vitals>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setPatient(null);
    setReason("");
    setNotes("");
    setVitals({});
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!patient) return;

    setErrors([]);
    setIsSubmitting(true);

    try {
      await createEncounter(patient.id, { reason, notes: notes || undefined, vitals });
      setSuccess(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors(["Erreur inattendue lors de l'enregistrement de la consultation."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-10 max-w-xl mx-auto space-y-8">
        <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-green-500 p-8 flex flex-col items-center text-white space-y-4">
            <CheckCircle2 className="w-16 h-16" />
            <h2 className="text-xl font-black uppercase tracking-[0.2em]">Consultation enregistrée</h2>
          </div>
          <div className="p-10">
            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                resetForm();
              }}
              className="w-full bg-zinc-900 text-white px-6 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
            >
              Nouvelle consultation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-4xl mx-auto space-y-10">
      <div className="border-b border-zinc-200 pb-10">
        <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-[0.2em] mb-3">Consultation</h1>
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
          Service Pédiatrie — Motif, notes cliniques et paramètres vitaux
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

        <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden p-10">
          <PatientPicker selected={patient} onSelect={setPatient} />
        </section>

        <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden p-10 space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Motif de consultation
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all text-xs"
              placeholder="Ex. : fièvre persistante depuis 3 jours"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Notes cliniques
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all text-xs resize-none"
              placeholder="Observations, examen clinique..."
            />
          </div>
        </section>

        <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden p-10">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-8">Paramètres vitaux</h2>
          <VitalsFields vitals={vitals} onChange={setVitals} />
        </section>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !patient}
            className="px-10 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer la consultation"}
          </button>
        </div>
      </form>
    </div>
  );
}
