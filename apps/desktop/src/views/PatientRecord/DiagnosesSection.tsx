import type { Diagnosis } from "../../lib/types";

export default function DiagnosesSection({ diagnoses }: { diagnoses: Diagnosis[] }) {
  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">Diagnostics</h2>
      </div>
      {diagnoses.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">Aucun diagnostic enregistré.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {diagnoses.map((diagnosis) => (
            <li key={diagnosis.id} className="flex items-center justify-between gap-4 px-8 py-4">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  {diagnosis.text}
                  {diagnosis.code && <span className="ml-2 text-xs font-normal text-zinc-400">CIM-10 {diagnosis.code}</span>}
                </p>
                <p className="text-xs text-zinc-500">
                  {diagnosis.date ? new Date(diagnosis.date).toLocaleDateString("fr-FR") : "Date inconnue"}
                  {diagnosis.recorder && ` · ${diagnosis.recorder}`}
                </p>
              </div>
              <span
                className={`rounded-xl border px-2 py-0.5 text-xs font-medium ${
                  diagnosis.certainty === "confirmed"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {diagnosis.certainty === "confirmed" ? "Confirmé" : "Provisoire"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
