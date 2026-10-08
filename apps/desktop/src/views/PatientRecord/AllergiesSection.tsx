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
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">Allergies connues</h2>
      </div>

      {canWrite && (
        <form onSubmit={handleSubmit} className="p-8 border-b border-zinc-100 space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 space-y-2 rounded-[18px]">
              {errors.map((message) => (
                <p key={message} className="text-xs font-medium text-red-700">
                  {message}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Substance</label>
              <input
                type="text"
                required
                value={substance}
                onChange={(event) => setSubstance(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                placeholder="Ex. : Pénicilline"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">
                Réaction (optionnel)
              </label>
              <input
                type="text"
                value={reaction}
                onChange={(event) => setReaction(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                placeholder="Ex. : Éruption cutanée"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-10 py-3 bg-[#1A6FD4] text-white text-sm font-medium hover:bg-[#155bb0] transition-all disabled:opacity-50 rounded-full"
          >
            {isSubmitting ? "Enregistrement..." : "Ajouter une allergie"}
          </button>
        </form>
      )}

      {allergies.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">
          Aucune allergie connue.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {allergies.map((allergy) => (
            <div key={allergy.id} className="p-8 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-red-700">{allergy.substance}</p>
                {allergy.reaction && <p className="text-xs text-zinc-600">{allergy.reaction}</p>}
              </div>
              <span className="text-sm text-zinc-400">
                {allergy.recordedDate ? new Date(allergy.recordedDate).toLocaleDateString("fr-FR") : "Date inconnue"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
