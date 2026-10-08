import { useEffect, useState } from "react";
import { Syringe, Search, ChevronRight, User } from "lucide-react";
import { ApiError, getPatientImmunizations, listPatients } from "../lib/api";
import type { Patient } from "../lib/types";

interface CarnetRow {
  key: string;
  patient: string;
  vaccine: string;
  dose: string;
  ageAtVaccination: string;
  date: string | null;
}

// Le socle FHIR actuel ne porte aucun calendrier vaccinal prévisionnel (pas de
// ressource type "âge cible par vaccin") : impossible de calculer un statut
// EN_RETARD/À_VENIR sans l'inventer. Cet écran affiche donc un carnet réel —
// les vaccins EFFECTIVEMENT enregistrés (Immunization) — plutôt que la file
// d'attente prévisionnelle de la maquette de référence.
function ageAt(birthDate: string, atDate: string): string {
  const birth = new Date(birthDate);
  const at = new Date(atDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return "—";
  let years = at.getFullYear() - birth.getFullYear();
  let months = at.getMonth() - birth.getMonth();
  if (at.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 1) return `${Math.max(months, 0)} mois`;
  return `${years} ans`;
}

export default function Vaccinations() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [rows, setRows] = useState<CarnetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Pas d'endpoint "toutes les Immunization" côté backend : on réutilise les
    // routes existantes, patient par patient (liste de patients raisonnable à
    // l'échelle d'un hôpital de district ; ne passerait pas à l'échelle d'un
    // volume beaucoup plus grand).
    listPatients()
      .then(async (data) => {
        if (cancelled) return;
        setPatients(data.patients);

        const perPatient = await Promise.all(
          data.patients.map((patient) =>
            getPatientImmunizations(patient.id)
              .then((result) => ({ patient, immunizations: result.immunizations }))
              .catch(() => ({ patient, immunizations: [] })),
          ),
        );
        if (cancelled) return;

        const allRows: CarnetRow[] = perPatient
          .flatMap(({ patient, immunizations }) =>
            immunizations.map((immunization) => ({
              key: immunization.id,
              patient: `${patient.firstName} ${patient.lastName}`,
              vaccine: immunization.vaccine ?? "Vaccin non précisé",
              dose: immunization.doseNumber ? `Dose ${immunization.doseNumber}` : "—",
              ageAtVaccination: immunization.date ? ageAt(patient.birthDate, immunization.date) : "—",
              date: immunization.date,
            })),
          )
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

        setRows(allRows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Erreur de chargement du carnet vaccinal.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const query = search.trim().toLowerCase();
  const filteredRows = query
    ? rows.filter((row) => row.patient.toLowerCase().includes(query) || row.vaccine.toLowerCase().includes(query))
    : rows;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-medium text-zinc-900">
            Programme élargi de vaccination
          </h1>
          <p className="text-sm font-medium text-zinc-400">
            Historique des vaccinations enregistrées — {patients.length} patient{patients.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
            <div className="p-8 border-b border-zinc-50 flex items-center justify-between bg-white rounded-[18px]">
              <h2 className="text-sm font-medium text-zinc-400">Carnet vaccinal</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher dans le carnet"
                    className="pl-9 pr-4 py-2 border border-zinc-200/70 text-xs bg-white focus:outline-none focus:border-[#1A6FD4] transition-all rounded-[18px]"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-6 bg-red-50 border-b border-red-100 text-sm font-medium text-red-700">{error}</div>
            )}

            <table className="w-full text-left">
              <thead>
                <tr className="bg-white text-xs font-medium text-zinc-300 border-b border-zinc-100">
                  <th className="px-8 py-5">Patient</th>
                  <th className="px-8 py-5">Vaccin</th>
                  <th className="px-8 py-5">Dose</th>
                  <th className="px-8 py-5">Âge à la vaccination</th>
                  <th className="px-8 py-5">Date</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-sm text-zinc-400">
                      Chargement du carnet vaccinal...
                    </td>
                  </tr>
                )}
                {!isLoading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-sm text-zinc-400">
                      Aucun vaccin enregistré.
                    </td>
                  </tr>
                )}
                {filteredRows.map((row) => (
                  <tr key={row.key} className="hover:bg-zinc-50/10 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-100 flex items-center justify-center rounded-none border border-zinc-200 group-hover:bg-zinc-900 group-hover:text-white transition-all text-zinc-400">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-zinc-900">
                          {row.patient}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-xs text-zinc-500 font-medium">{row.vaccine}</td>
                    <td className="px-8 py-6 text-sm text-zinc-400 font-medium">{row.dose}</td>
                    <td className="px-8 py-6 text-sm text-zinc-400 font-medium">
                      {row.ageAtVaccination}
                    </td>
                    <td className="px-8 py-6 text-sm font-medium text-zinc-900">
                      {row.date ? new Date(row.date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button className="p-2 hover:bg-zinc-100 transition-all opacity-0 group-hover:opacity-100">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-8">
          <div className="p-8 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center space-y-4 opacity-60">
            <Syringe className="w-8 h-8 text-zinc-300" />
            <p className="text-xs font-medium text-zinc-400 leading-relaxed">
              Pas de calendrier PEV prévisionnel dans ce socle : seuls les vaccins déjà enregistrés sont affichés.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
