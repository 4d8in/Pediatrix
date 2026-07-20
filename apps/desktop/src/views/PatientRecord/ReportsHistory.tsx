import type { Report } from "../../lib/types";

export default function ReportsHistory({ reports }: { reports: Report[] }) {
  return (
    <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">Résultats de laboratoire</h2>
      </div>

      {reports.length === 0 ? (
        <p className="p-10 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
          Aucun résultat disponible.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {reports.map((report) => (
            <div key={report.id} className="p-8 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-tight text-zinc-900">
                  {report.exam ?? "Examen non précisé"}
                </p>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                  {report.date ? new Date(report.date).toLocaleString("fr-FR") : "Date inconnue"}
                </span>
              </div>

              {report.conclusion && <p className="text-xs text-zinc-600">{report.conclusion}</p>}

              {report.results.length > 0 && (
                <div className="flex flex-wrap gap-4 pt-2">
                  {report.results.map((result) => (
                    <span
                      key={result.label}
                      className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50 border border-zinc-200 px-3 py-1"
                    >
                      {result.label}: {result.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
