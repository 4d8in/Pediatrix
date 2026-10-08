import type { ImagingReport } from "../../lib/types";

export default function ImagingReportsHistory({ reports }: { reports: ImagingReport[] }) {
  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">Comptes-rendus d'imagerie</h2>
      </div>

      {reports.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">
          Aucun compte-rendu disponible.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {reports.map((report) => (
            <div key={report.id} className="p-8 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-900">
                  {report.exam ?? "Examen non précisé"}
                </p>
                <span className="text-sm text-zinc-400">
                  {report.date ? new Date(report.date).toLocaleString("fr-FR") : "Date inconnue"}
                </span>
              </div>

              {report.conclusion && <p className="text-xs text-zinc-600">{report.conclusion}</p>}

              {report.results.length > 0 && (
                <div className="flex flex-wrap gap-4 pt-2">
                  {report.results.map((result) => (
                    <span
                      key={result.label}
                      className="text-sm font-medium text-zinc-500 bg-zinc-50 border border-zinc-200 px-3 py-1 rounded-xl"
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
