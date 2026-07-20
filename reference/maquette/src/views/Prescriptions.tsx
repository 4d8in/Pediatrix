import React from 'react';
import { Pill, Search, Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

const PRESCRIPTIONS_MOCK = [
  { id: 'RX-101', patient: 'Amadou Bah', med: 'Artéméther-Luméfantrine', dose: '1 cp x 2/j', status: 'DUE', next: '18:00' },
  { id: 'RX-102', patient: 'Amina Osei', med: 'Amoxicilline', dose: '5ml x 3/j', status: 'GIVEN', next: '22:00' },
  { id: 'RX-103', patient: 'Maya Patel', med: 'Paracétamol', dose: '250mg x 4/j', status: 'DUE', next: '16:30' },
  { id: 'RX-104', patient: 'Liam O\'Connor', med: 'SRO', dose: 'ad libitum', status: 'ACTIVE', next: '-' },
  { id: 'RX-105', patient: 'Zara Khan', med: 'Ceftriaxone', dose: '1g IV/j', status: 'PENDING', next: '15:00' },
];

export default function Prescriptions() {
  return (
    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Module_De_Prescription</h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Suivi des soins médicamenteux • Temps Réel
          </p>
        </div>
        
        <div className="flex gap-4">
          <button className="px-6 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all shadow-lg flex items-center gap-3">
            <Pill className="w-4 h-4" /> Nouvelle Ordonnance
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Due list */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white border border-zinc-200 p-8 space-y-6">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">À_Administrer_Maintenant</h2>
              <div className="space-y-4">
                 {PRESCRIPTIONS_MOCK.filter(p => p.status === 'DUE').map(p => (
                   <div key={p.id} className="flex items-center justify-between p-6 bg-red-50/50 border border-red-100 group hover:shadow-md transition-all">
                      <div className="flex items-center gap-6">
                         <div className="w-12 h-12 bg-red-100 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-red-600 animate-pulse" />
                         </div>
                         <div className="space-y-1">
                            <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">{p.med}</span>
                            <div className="flex items-center gap-3">
                               <span className="text-[10px] font-mono text-zinc-400 uppercase">{p.patient}</span>
                               <span className="text-[10px] font-bold text-red-600">DUE @ {p.next}</span>
                            </div>
                         </div>
                      </div>
                      <button className="px-6 py-2 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all">
                         Valider Prise
                      </button>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
                 <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Toutes_Les_Prescriptions_Actives</h2>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                    <input 
                      type="text" 
                      placeholder="FILTRER..."
                      className="pl-9 pr-4 py-2 border border-zinc-100 text-[9px] font-mono focus:outline-none focus:border-zinc-900 transition-all uppercase"
                    />
                 </div>
              </div>
              <table className="w-full text-left">
                 <thead>
                    <tr className="bg-zinc-50/50 text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                       <th className="px-8 py-4">PATIENT</th>
                       <th className="px-8 py-4">MÉDICAMENT</th>
                       <th className="px-8 py-4">POSOLOGIE</th>
                       <th className="px-8 py-4">PROCHAINE_PRISE</th>
                       <th className="px-8 py-4">STATUT</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-50">
                    {PRESCRIPTIONS_MOCK.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-50/30 transition-colors">
                         <td className="px-8 py-5 text-[11px] font-black uppercase text-zinc-900">{p.patient}</td>
                         <td className="px-8 py-5 text-xs text-zinc-500 font-bold">{p.med}</td>
                         <td className="px-8 py-5 text-[10px] font-mono text-zinc-400 uppercase">{p.dose}</td>
                         <td className="px-8 py-5 text-[10px] font-mono font-bold text-zinc-900">{p.next}</td>
                         <td className="px-8 py-5">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm",
                              p.status === 'GIVEN' ? "bg-green-100 text-green-700" :
                              p.status === 'PENDING' ? "bg-zinc-100 text-zinc-500" :
                              p.status === 'ACTIVE' ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                            )}>{p.status}</span>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        {/* Right Column: Safety & Stock */}
        <div className="space-y-8">
           <div className="bg-zinc-900 text-white p-8 space-y-6">
              <div className="flex items-center gap-4 text-amber-500">
                 <AlertTriangle className="w-5 h-5" />
                 <h3 className="text-[10px] font-black uppercase tracking-widest">Alertes_Pharmacie</h3>
              </div>
              <div className="space-y-4">
                 {[
                   { label: 'Artéméther', issue: 'Stock critique (5 flux)', priority: 'HIGH' },
                   { label: 'SRO', issue: 'Péremption proche', priority: 'LOW' }
                 ].map(item => (
                   <div key={item.label} className="p-4 border border-white/10 flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase tracking-tight">{item.label}</span>
                      <span className="text-[9px] font-mono text-white/40 uppercase">{item.issue}</span>
                   </div>
                 ))}
              </div>
              <button className="w-full py-4 bg-white text-zinc-900 text-[9px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center justify-center gap-3">
                 Commander stock <ArrowRight className="w-3 h-3" />
              </button>
           </div>

           <div className="bg-white border border-zinc-200 p-8 space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Récemment_Donnés</h3>
              <div className="space-y-4">
                 {(() => {
                   const given = PRESCRIPTIONS_MOCK.find(p => p.status === 'GIVEN');
                   return given && (
                     <div className="flex items-center gap-4 opacity-60">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black uppercase tracking-tight text-zinc-900">{given.med}</span>
                           <span className="text-[8px] font-mono text-zinc-400 uppercase">Donné à {given.patient} à 14:40</span>
                        </div>
                     </div>
                   );
                 })()}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
