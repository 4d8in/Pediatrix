import React from 'react';
import { Syringe, Search, Calendar, ChevronRight, User } from 'lucide-react';
import { cn } from '../lib/utils';

const VACCINES_MOCK = [
  { id: 'V-01', patient: 'Amadou Bah', vaccine: 'VPO (Polio)', age: '9 mois', date: '21/04/2025', status: 'OVERDUE' },
  { id: 'V-02', patient: 'Amina Osei', vaccine: 'Penta 3', age: '14 semaines', date: '18/04/2025', status: 'DONE' },
  { id: 'V-03', patient: 'Baby Diop', vaccine: 'BCG/VPO 0', age: 'Naissance', date: '19/04/2025', status: 'DUE_TODAY' },
  { id: 'V-04', patient: 'Sara Kone', vaccine: 'RR 1', age: '9 mois', date: '25/04/2025', status: 'UPCOMING' },
];

export default function Vaccinations() {
  return (
    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Programme_Élargi_De_Vaccination</h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Suivi du calendrier vaccinal • PEV R4
          </p>
        </div>
        
        <div className="flex gap-4">
          <button className="px-6 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center gap-3">
            <Calendar className="w-4 h-4" /> Campagne en cours
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3 space-y-8">
           <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/30">
                 <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">File_D_Attente_Vaccination</h2>
                 <div className="flex items-center gap-4">
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                      <input 
                        type="text" 
                        placeholder="RECHERCHER_CARNET..."
                        className="pl-9 pr-4 py-2 border border-zinc-200 text-[9px] font-mono bg-white focus:outline-none focus:border-zinc-900 transition-all uppercase"
                      />
                   </div>
                 </div>
              </div>
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-white text-[9px] font-black uppercase tracking-widest text-zinc-300 border-b border-zinc-100">
                       <th className="px-8 py-5">PATIENT</th>
                       <th className="px-8 py-5">VACCIN_REQUIS</th>
                       <th className="px-8 py-5">ÂGE_CIBLE</th>
                       <th className="px-8 py-5">DATE_PRÉVUE</th>
                       <th className="px-8 py-5">STATUT</th>
                       <th className="px-8 py-5"></th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-50">
                    {VACCINES_MOCK.map((v) => (
                      <tr key={v.id} className="hover:bg-zinc-50/10 transition-colors group">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-zinc-100 flex items-center justify-center rounded-none border border-zinc-200 group-hover:bg-zinc-900 group-hover:text-white transition-all text-zinc-400">
                                  <User className="w-4 h-4" />
                               </div>
                               <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">{v.patient}</span>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-xs text-zinc-500 font-bold tracking-tight">{v.vaccine}</td>
                         <td className="px-8 py-6 text-[10px] font-mono uppercase text-zinc-400 font-bold">{v.age}</td>
                         <td className="px-8 py-6 text-[10px] font-mono font-bold text-zinc-900">{v.date}</td>
                         <td className="px-8 py-6">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm",
                              v.status === 'DONE' ? "bg-green-100 text-green-700 font-bold" :
                              v.status === 'OVERDUE' ? "bg-red-500 text-white shadow-sm" :
                              v.status === 'DUE_TODAY' ? "bg-amber-400 text-zinc-900 font-bold" :
                              "bg-zinc-100 text-zinc-400"
                            )}>
                              {v.status.replace('_', ' ')}
                            </span>
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
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Couverture_Vaccinale_Hebdo</h3>
                 <p className="text-3xl font-black italic">82.4%</p>
                 <div className="h-1 bg-white/20 w-full overflow-hidden">
                    <div className="h-full bg-white w-[82%]"></div>
                 </div>
              </div>
              <p className="text-[9px] font-mono leading-relaxed opacity-80 uppercase tracking-widest">
                 Objectif : 95% pour l'immunité collective. 12 enfants rappelés ce matin.
              </p>
              <button className="w-full py-3 bg-white text-[#1A6FD4] text-[9px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all">
                 Générer rapports PEV
              </button>
           </div>
           
           <div className="bg-zinc-900 text-white p-8 space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Prochaines_Campagnes</h3>
              <div className="space-y-4">
                 {[
                   { name: 'Suppl. Vitamine A', date: '01/06/2025' },
                   { name: 'Journées Polio', date: '15/06/2025' }
                 ].map(c => (
                   <div key={c.name} className="flex items-center justify-between border-l-2 border-amber-500 pl-4 py-1">
                      <div className="flex flex-col">
                         <span className="text-[10px] font-black uppercase tracking-tight">{c.name}</span>
                         <span className="text-[8px] font-mono text-zinc-500 uppercase">{c.date}</span>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
