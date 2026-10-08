import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../lib/auth-context";
import { ApiError, createImmunization } from "../../lib/api";
import type { Immunization } from "../../lib/types";

export default function ImmunizationSection({
  patientId,
  immunizations,
  onCreated,
}: {
  patientId: string;
  immunizations: Immunization[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const canWrite = user?.role === "doctor" || user?.role === "nurse";

  const [vaccine, setVaccine] = useState("");
  const [date, setDate] = useState("");
  const [doseNumber, setDoseNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      await createImmunization(patientId, {
        vaccine,
        date,
        doseNumber: doseNumber ? Number(doseNumber) : undefined,
      });
      setVaccine("");
      setDate("");
      setDoseNumber("");
      onCreated();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors(["Erreur inattendue lors de l'enregistrement du vaccin."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">Carnet vaccinal</h2>
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

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Vaccin</label>
              <input
                type="text"
                required
                value={vaccine}
                onChange={(event) => setVaccine(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                placeholder="Ex. : BCG"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Date</label>
              <input
                type="text"
                inputMode="numeric"
                required
                pattern="\d{4}-\d{2}-\d{2}"
                title="Format AAAA-MM-JJ"
                placeholder="AAAA-MM-JJ"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">
                Dose (optionnel)
              </label>
              <input
                type="number"
                min={1}
                value={doseNumber}
                onChange={(event) => setDoseNumber(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                placeholder="Ex. : 3"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-10 py-3 bg-[#1A6FD4] text-white text-sm font-medium hover:bg-[#155bb0] transition-all disabled:opacity-50 rounded-full"
          >
            {isSubmitting ? "Enregistrement..." : "Ajouter au carnet"}
          </button>
        </form>
      )}

      {immunizations.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">
          Aucun vaccin enregistré.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {immunizations.map((immunization) => (
            <div key={immunization.id} className="p-8 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-zinc-900">
                  {immunization.vaccine ?? "Vaccin non précisé"}
                  {immunization.doseNumber ? ` — dose ${immunization.doseNumber}` : ""}
                </p>
                {immunization.notes && <p className="text-xs text-zinc-600">{immunization.notes}</p>}
              </div>
              <span className="text-sm text-zinc-400">
                {immunization.date ? new Date(immunization.date).toLocaleDateString("fr-FR") : "Date inconnue"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
