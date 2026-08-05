import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../lib/auth-context";
import { ApiError, createAllergy } from "../../lib/api";
import type { Allergy } from "../../lib/types";

export default function AllergiesSection({
  patientId,
  allergies,
  onCreated,
}: {
  patientId: string;
  allergies: Allergy[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const canWrite = user?.role === "doctor" || user?.role === "nurse";

  const [substance, setSubstance] = useState("");
  const [reaction, setReaction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      await createAllergy(patientId, { substance, reaction: reaction || undefined });
      setSubstance("");
      setReaction("");
      onCreated();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors(["Erreur inattendue lors de l'enregistrement de l'allergie."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">Allergies connues</h2>
      </div>

      {canWrite && (
        <form onSubmit={handleSubmit} className="p-8 border-b border-zinc-100 space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 space-y-2">
              {errors.map((message) => (
                <p key={message} className="text-xs font-bold text-red-700">
                  {message}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Substance</label>
              <input
                type="text"
                required
                value={substance}
                onChange={(event) => setSubstance(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all text-xs"
                placeholder="Ex. : Pénicilline"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Réaction (optionnel)
              </label>
              <input
                type="text"
                value={reaction}
                onChange={(event) => setReaction(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all text-xs"
                placeholder="Ex. : Éruption cutanée"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-10 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Enregistrement..." : "Ajouter une allergie"}
          </button>
        </form>
      )}

      {allergies.length === 0 ? (
        <p className="p-10 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
          Aucune allergie connue.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {allergies.map((allergy) => (
            <div key={allergy.id} className="p-8 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-tight text-red-700">{allergy.substance}</p>
                {allergy.reaction && <p className="text-xs text-zinc-600">{allergy.reaction}</p>}
              </div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                {allergy.recordedDate ? new Date(allergy.recordedDate).toLocaleDateString("fr-FR") : "Date inconnue"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
