import { Bed as BedIcon, User, AlertCircle } from "lucide-react";
import PreviewBanner from "../components/PreviewBanner";

const WARD_MOCK = [
  { id: "P-01", patient: "Amina Osei", status: "CRITICAL" },
  { id: "P-02", patient: null, status: "CLEAN" },
  { id: "P-03", patient: "Liam O'Connor", status: "STABLE" },
  { id: "P-04", patient: "Maya Patel", status: "STABLE" },
  { id: "P-05", patient: null, status: "MAINTENANCE" },
  { id: "P-06", patient: null, status: "CLEAN" },
  { id: "P-07", patient: "Amadou Bah", status: "STABLE" },
  { id: "P-08", patient: null, status: "CLEAN" },
  { id: "P-09", patient: "Zara Khan", status: "STABLE" },
  { id: "P-10", patient: "Enzo Ferrari", status: "RECOVERY" },
];

export default function WardMap() {
  return (
    <div className="p-10 space-y-10">
      <PreviewBanner />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Carte_Occupation_Salles</h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Temps Réel • Mise à jour il y a 45s
          </p>
        </div>
        <div className="flex gap-4">
          {[
            { label: "Critique", color: "bg-red-500" },
            { label: "Stable", color: "bg-green-500" },
            { label: "Libre", color: "bg-zinc-200" },
            { label: "Entretien", color: "bg-amber-400" },
          ].map((lg) => (
            <div key={lg.label} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${lg.color}`}></div>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{lg.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        {WARD_MOCK.map((bed) => (
          <div
            key={bed.id}
            className={`bg-white border-2 p-6 flex flex-col gap-6 transition-all group hover:scale-[1.02] ${
              bed.patient ? "border-zinc-200 shadow-sm" : "border-dashed border-zinc-200 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-900">{bed.id}</span>
              <BedIcon
                className={`w-4 h-4 ${
                  bed.status === "CRITICAL"
                    ? "text-red-500"
                    : bed.status === "CLEAN"
                      ? "text-zinc-300"
                      : bed.status === "STABLE"
                        ? "text-green-500"
                        : "text-amber-500"
                }`}
              />
            </div>

            <div className="h-20 flex flex-col justify-center">
              {bed.patient ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900 line-clamp-1">
                    {bed.patient}
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        bed.status === "CRITICAL" ? "bg-red-500" : "bg-green-500"
                      }`}
                    ></div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                      {bed.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center opacity-30">
                  <User className="w-6 h-6 mb-2" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Disponible</span>
                </div>
              )}
            </div>

            {bed.patient && (
              <button className="w-full py-2 bg-zinc-50 border border-zinc-100 text-[8px] font-black uppercase tracking-widest text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white group-hover:border-zinc-900 transition-all">
                Voir Dossier →
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 text-white p-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="p-3 bg-white/10">
            <AlertCircle className="w-6 h-6 text-amber-400" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-[0.1em]">Alerte_Capacité</p>
            <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
              Taux d'occupation : 60% • 4 lits pédiatriques disponibles
            </p>
          </div>
        </div>
        <button className="px-6 py-2 bg-white text-zinc-900 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
          Optimiser le placement
        </button>
      </div>
    </div>
  );
}
