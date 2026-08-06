import { useEffect, useState } from "react";
import { Syringe, Search, Calendar, ChevronRight, User } from "lucide-react";
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
const CAMPAIGNS_DEMO = [
  { name: "Suppl. Vitamine A", date: "01/06/2025" },
  { name: "Journées Polio", date: "15/06/2025" },
];

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
    <div className="p-10 space-y-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">
            Programme_Élargi_De_Vaccination
          </h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Historique des vaccinations enregistrées — {patients.length} patient{patients.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            title="Démonstration — aucune campagne réelle n'est gérée par le backend"
            className="px-6 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center gap-3"
          >
            <Calendar className="w-4 h-4" /> Campagne en cours
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/30">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Carnet_Vaccinal</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="RECHERCHER_CARNET..."
                    className="pl-9 pr-4 py-2 border border-zinc-200 text-[9px] font-mono bg-white focus:outline-none focus:border-zinc-900 transition-all uppercase"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-6 bg-red-50 border-b border-red-100 text-[11px] font-bold text-red-700">{error}</div>
            )}

            <table className="w-full text-left">
              <thead>
                <tr className="bg-white text-[9px] font-black uppercase tracking-widest text-zinc-300 border-b border-zinc-100">
                  <th className="px-8 py-5">PATIENT</th>
                  <th className="px-8 py-5">VACCIN</th>
                  <th className="px-8 py-5">DOSE</th>
                  <th className="px-8 py-5">ÂGE_À_LA_VACCINATION</th>
                  <th className="px-8 py-5">DATE</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                      Chargement du carnet vaccinal...
                    </td>
                  </tr>
                )}
                {!isLoading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-10 text-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
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
                        <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                          {row.patient}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-xs text-zinc-500 font-bold tracking-tight">{row.vaccine}</td>
                    <td className="px-8 py-6 text-[10px] font-mono uppercase text-zinc-400 font-bold">{row.dose}</td>
                    <td className="px-8 py-6 text-[10px] font-mono uppercase text-zinc-400 font-bold">
                      {row.ageAtVaccination}
                    </td>
                    <td className="px-8 py-6 text-[10px] font-mono font-bold text-zinc-900">
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
          <div className="bg-[#1A6FD4] text-white p-8 space-y-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                  Couverture_Vaccinale_Hebdo
                </h3>
                <span className="text-[8px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5">Démo</span>
              </div>
              <p className="text-3xl font-black italic">82.4%</p>
              <div className="h-1 bg-white/20 w-full overflow-hidden">
                <div className="h-full bg-white w-[82%]"></div>
              </div>
            </div>
            <p className="text-[9px] font-mono leading-relaxed opacity-80 uppercase tracking-widest">
              Donnée de démonstration — aucun calcul de couverture vaccinale n'existe côté backend.
            </p>
            <button
              title="Démonstration — aucune génération de rapport n'est gérée par le backend"
              className="w-full py-3 bg-white text-[#1A6FD4] text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
            >
              Générer rapports PEV
            </button>
          </div>

          <div className="bg-zinc-900 text-white p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Prochaines_Campagnes</h3>
              <span className="text-[8px] font-black uppercase tracking-widest bg-white/10 px-2 py-0.5 text-zinc-400">
                Démo
              </span>
            </div>
            <div className="space-y-4">
              {CAMPAIGNS_DEMO.map((c) => (
                <div key={c.name} className="flex items-center justify-between border-l-2 border-amber-500 pl-4 py-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-tight">{c.name}</span>
                    <span className="text-[8px] font-mono text-zinc-500 uppercase">{c.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center space-y-4 opacity-60">
            <Syringe className="w-8 h-8 text-zinc-300" />
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-relaxed">
              Pas de calendrier PEV prévisionnel dans ce socle : seuls les vaccins déjà enregistrés sont affichés.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
