import { Printer } from "lucide-react";
import { LabReportSheet } from "../../components/print/PrintSheets";
import { usePrint } from "../../lib/print";
import type { Patient, Report } from "../../lib/types";

export default function ReportsHistory({ reports, patient }: { reports: Report[]; patient: Patient }) {
  const { printDocument } = usePrint();
  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100">
        <h2 className="text-sm font-medium">Résultats de laboratoire</h2>
      </div>

      {reports.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">
          Aucun résultat disponible.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {reports.map((report) => (
            <div key={report.id} className="p-8 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-900">
                  {report.exam ?? "Examen non précisé"}
                </p>
                <span className="flex items-center gap-4 text-sm text-zinc-400">
                  {report.date ? new Date(report.date).toLocaleString("fr-FR") : "Date inconnue"}
                  <button
                    type="button"
                    data-testid="print-report"
                    onClick={() => printDocument((facility) => <LabReportSheet facility={facility} patient={patient} report={report} />)}
                    className="flex items-center gap-1 text-xs font-medium text-[#1A6FD4] hover:underline"
                  >
                    <Printer className="h-3.5 w-3.5" /> Imprimer
                  </button>
                </span>
              </div>

              {report.conclusion && <p className="text-xs text-zinc-600">{report.conclusion}</p>}

              {report.results.length > 0 && (
                <div className="flex flex-wrap gap-4 pt-2">
                  {report.results.map((result) => (
                    <span
                      key={result.label}
                      className={`text-sm font-medium border px-3 py-1 rounded-xl ${
                        result.flag === "H" || result.flag === "L"
                          ? "text-red-700 bg-red-50 border-red-200"
                          : "text-zinc-500 bg-zinc-50 border-zinc-200"
                      }`}
                    >
                      {result.label}: {result.value}
                      {result.flag === "H" && " ↑"}
                      {result.flag === "L" && " ↓"}
                      {result.reference && (
                        <span className="ml-2 text-xs font-normal text-zinc-400">(réf. {result.reference})</span>
                      )}
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
