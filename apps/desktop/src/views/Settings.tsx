import { Settings as SettingsIcon, Database, Globe, Bell, Shield, Terminal, Save } from "lucide-react";
import PreviewBanner from "../components/PreviewBanner";

const SECTIONS = [
  { id: "gen", label: "Général", icon: SettingsIcon, active: true },
  { id: "int", label: "Intégration FHIR", icon: Database },
  { id: "not", label: "Notifications", icon: Bell },
  { id: "sec", label: "Sécurité & OAuth", icon: Shield },
  { id: "dev", label: "Console Dev", icon: Terminal },
];

export default function Settings() {
  return (
    <div className="p-10 space-y-10">
      <PreviewBanner />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Configuration_Globale</h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Architecture • Intégration • Préférences Système
          </p>
        </div>
        <button className="px-8 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center gap-3 shadow-xl">
          <Save className="w-4 h-4" /> Enregistrer_Tout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="flex flex-col gap-2">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              className={`flex items-center gap-4 px-6 py-4 text-left transition-all ${
                item.active ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="md:col-span-3 space-y-10">
          <div className="bg-white border border-zinc-200 p-10 space-y-12">
            <div className="space-y-8">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">
                Architecture_Intégration
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Endpoint FHIR Serveur
                  </label>
                  <input
                    type="text"
                    defaultValue="https://fhir.dakar-hospital.sn/v4"
                    className="w-full bg-zinc-50 border border-zinc-200 px-6 py-4 text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-zinc-900 transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Node ID (Local)
                  </label>
                  <input
                    type="text"
                    defaultValue="PED-DK-012"
                    className="w-full bg-zinc-50 border border-zinc-200 px-6 py-4 text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-zinc-900 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">
                Synchronisation_&_Cache
              </h2>
              <div className="flex items-center justify-between p-6 bg-zinc-50 border border-zinc-100">
                <div className="space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                    Mode Hors-Ligne Automatique
                  </span>
                  <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
                    Poursuivre la saisie même en cas de coupure réseau
                  </p>
                </div>
                <div className="w-12 h-6 bg-zinc-900 rounded-full relative p-1 cursor-pointer">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1"></div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Régionalisation</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Langue du Système
                  </label>
                  <select className="w-full bg-zinc-50 border border-zinc-200 px-6 py-4 text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-900 transition-all appearance-none rounded-none">
                    <option>Français (Régional)</option>
                    <option>Wolof (Bêta)</option>
                    <option>English</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Fuseau Horaire
                  </label>
                  <div className="flex items-center gap-4 text-sm font-bold text-zinc-900 bg-zinc-50 border border-zinc-200 px-6 py-4">
                    <Globe className="w-4 h-4 text-zinc-400" />
                    <span>GMT/UTC +00:00 (Dakar)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 p-10 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-12 h-12 bg-red-100 text-red-600 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-red-700">Zone_Critique</h3>
              <p className="text-[10px] font-mono font-bold text-red-600/60 uppercase tracking-widest leading-relaxed max-w-sm">
                La réinitialisation supprimera tout le cache local et les données non synchronisées.
              </p>
            </div>
            <button className="px-8 py-3 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all">
              Réinitialiser_Database_Locale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
