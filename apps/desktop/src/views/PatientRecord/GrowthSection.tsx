import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../lib/auth-context";
import { ApiError, createGrowthMeasurement } from "../../lib/api";
import type { GrowthMeasurement } from "../../lib/types";

// Courbe simple, sans dépendance externe (pas de calcul de z-score) : une
// polyligne SVG reliant les valeurs de poids dans le temps.
function WeightCurve({ measurements }: { measurements: GrowthMeasurement[] }) {
  const points = measurements
    .filter((m): m is GrowthMeasurement & { weight: number } => m.weight !== undefined)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  if (points.length < 2) return null;

  const width = 480;
  const height = 120;
  const padding = 16;
  const weights = points.map((p) => p.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1;

  const coords = points.map((p, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p.weight - minWeight) / range) * (height - padding * 2);
    return { x, y };
  });

  const path = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
      <polyline points={path} fill="none" stroke="#1A6FD4" strokeWidth={2} />
      {coords.map((c, index) => (
        <circle key={points[index].date} cx={c.x} cy={c.y} r={3} fill="#1A6FD4" />
      ))}
    </svg>
  );
}

export default function GrowthSection({
  patientId,
  measurements,
  onCreated,
}: {
  patientId: string;
  measurements: GrowthMeasurement[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const canWrite = user?.role === "doctor" || user?.role === "nurse";

  const [date, setDate] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [headCircumference, setHeadCircumference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      await createGrowthMeasurement(patientId, {
        date,
        weight: weight ? Number(weight) : undefined,
        height: height ? Number(height) : undefined,
        headCircumference: headCircumference ? Number(headCircumference) : undefined,
      });
      setDate("");
      setWeight("");
      setHeight("");
      setHeadCircumference("");
      onCreated();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors(["Erreur inattendue lors de l'enregistrement de la mesure."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">Croissance</h2>
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

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all text-xs"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Poids (kg)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all text-xs"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taille (cm)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all text-xs"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Périmètre crânien (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min={0}
                value={headCircumference}
                onChange={(event) => setHeadCircumference(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-10 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Enregistrement..." : "Ajouter une mesure"}
          </button>
        </form>
      )}

      {measurements.length === 0 ? (
        <p className="p-10 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
          Aucune mesure enregistrée.
        </p>
      ) : (
        <>
          <div className="p-8 border-b border-zinc-100">
            <WeightCurve measurements={measurements} />
          </div>
          <div className="divide-y divide-zinc-100">
            {measurements.map((measurement) => (
              <div key={measurement.date} className="p-8 flex items-center justify-between">
                <div className="flex flex-wrap gap-4">
                  {measurement.weight !== undefined && (
                    <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50 border border-zinc-200 px-3 py-1">
                      Poids: {measurement.weight} kg
                    </span>
                  )}
                  {measurement.height !== undefined && (
                    <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50 border border-zinc-200 px-3 py-1">
                      Taille: {measurement.height} cm
                    </span>
                  )}
                  {measurement.headCircumference !== undefined && (
                    <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50 border border-zinc-200 px-3 py-1">
                      PC: {measurement.headCircumference} cm
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                  {new Date(measurement.date).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
