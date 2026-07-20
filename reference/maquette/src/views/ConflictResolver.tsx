import React from 'react';
import { RefreshCcw, AlertTriangle, ArrowRight, Save, History } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ConflictResolver() {
  return (
    <div className="fixed inset-0 z-[300] bg-zinc-950 flex flex-col text-white animate-in fade-in">
       <div className="p-8 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
             <div className="p-2 bg-amber-500/10 rounded-lg">
                <RefreshCcw className="w-5 h-5 text-amber-500 animate-spin-slow" />
             </div>
             <div className="space-y-1">
                <h1 className="text-sm font-black uppercase tracking-[0.3em]">Résolveur_De_Conflits_Synchronisation</h1>
                <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
                   Données modifiées hors-ligne détectées • Veuillez choisir la version à conserver
                </p>
             </div>
          </div>
          <button className="bg-white/5 border border-white/10 px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
             Fermer ×
          </button>
       </div>

       <div className="flex-1 flex overflow-hidden">
          <div className="max-w-6xl mx-auto w-full p-20 flex flex-col gap-16 overflow-y-auto">
             
             <div className="flex items-center justify-center gap-20">
                {/* Local Version */}
                <div className="flex-1 space-y-8 animate-in slide-in-from-left-10">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-blue-500"></div> Version Locale (Votre App)
                      </span>
                      <span className="text-[9px] font-mono text-zinc-600">Modifié: Il y a 12m</span>
                   </div>
                   <div className="bg-zinc-900 border border-blue-500/30 p-10 space-y-10 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 bg-blue-500 text-[10px] font-black uppercase tracking-widest">MODIFIÉ</div>
                      <div className="space-y-4">
                         <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Observations Consultation</label>
                         <p className="text-sm font-bold text-zinc-100 leading-relaxed">
                            "Suspicion paludisme simple. Patient en attente NFS. Déshydratation légère notée (+ légère léthargie)."
                         </p>
                      </div>
                      <div className="pt-8 border-t border-white/5">
                         <button className="w-full py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-3">
                            <Save className="w-4 h-4" /> Garder cette version
                         </button>
                      </div>
                   </div>
                </div>

                {/* Conflict Icon */}
                <div className="flex flex-col items-center gap-4 text-amber-500 shrink-0">
                   <AlertTriangle className="w-12 h-12" />
                   <div className="h-40 w-px bg-gradient-to-b from-transparent via-amber-500/30 to-transparent"></div>
                </div>

                {/* Cloud Version */}
                <div className="flex-1 space-y-8 animate-in slide-in-from-right-10">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-purple-500"></div> Version Cloud (Dr. Diallo)
                      </span>
                      <span className="text-[9px] font-mono text-zinc-600">Modifié: Il y a 5m</span>
                   </div>
                   <div className="bg-zinc-900 border border-purple-500/30 p-10 space-y-10 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 bg-purple-500 text-[10px] font-black uppercase tracking-widest">SERVEUR</div>
                      <div className="space-y-4">
                         <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Observations Consultation</label>
                         <p className="text-sm font-bold text-zinc-100 leading-relaxed">
                            "Paludisme suspecté. NFS demandée. Patient stable. Pas de signes de danger immédiats."
                         </p>
                      </div>
                      <div className="pt-8 border-t border-white/5">
                         <button className="w-full py-4 bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center justify-center gap-3">
                            <History className="w-4 h-4" /> Écraser mes données
                         </button>
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-amber-500/10 border border-amber-500/20 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                   <div className="p-4 bg-amber-500/20 text-amber-500">
                      <AlertTriangle className="w-8 h-8" />
                   </div>
                   <div className="space-y-2 text-left">
                      <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">Action_Requise</h4>
                      <p className="text-xs font-medium text-zinc-400 leading-relaxed max-w-xl">
                         Un conflit de fusion automatique a échoué car le champ <span className="font-black text-white italic">"observations"</span> a été modifié simultanément sur deux appareils.
                      </p>
                   </div>
                </div>
                <button className="px-10 py-4 bg-white text-zinc-900 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all flex items-center gap-4">
                   Fusion Manuelle <ArrowRight className="w-4 h-4" />
                </button>
             </div>

          </div>
       </div>
    </div>
  );
}
