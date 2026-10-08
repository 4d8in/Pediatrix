import type { PatientStay } from "../../lib/types";

function formatDate(date: string | null): string {
  return date ? new Date(date).toLocaleDateString("fr-FR") : "—";
}

function durationDays(start: string | null, end: string | null): string {
  if (!start) return "—";
  const days = Math.floor(((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 86_400_000);
  return days < 1 ? "< 1 j" : `${days} j`;
}

// Séjours hospitaliers du patient (module Hospitalisation), avec les lits occupés.
export default function StaysSection({ stays }: { stays: PatientStay[] }) {
  return (
    <section className="rounded-[18px] border border-zinc-200/70 bg-white">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-sm font-medium">Hospitalisations</h2>
      </div>
      {stays.length === 0 ? (
        <p className="p-5 text-sm text-zinc-400">Aucune hospitalisation enregistrée.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {stays.map((stay) => (
            <li key={stay.id} className="space-y-1 p-5 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900">
                  Du {formatDate(stay.start)} {stay.end ? `au ${formatDate(stay.end)}` : ""} · {durationDays(stay.start, stay.end)}
                </p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    stay.inProgress ? "bg-[#1A6FD4]/10 text-[#1A6FD4]" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {stay.inProgress ? "En cours" : "Terminé"}
                </span>
              </div>
              {stay.reason && <p className="text-zinc-600">Motif : {stay.reason}</p>}
              <p className="text-zinc-500">Lits : {stay.beds.map((bed) => bed.name).join(" → ") || "—"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
