import React from 'react';
import { Stethoscope, Search, Filter, ArrowRight, Clock, User } from 'lucide-react';
import { cn } from '../lib/utils';

const CONSULTATIONS_MOCK = [
  { id: 'C-2024-401', patient: 'Amadou Bah', doctor: 'Dr. Diallo', time: '14:32', type: 'Suivi Paludisme', status: 'En cours' },
  { id: 'C-2024-400', patient: 'Maya Patel', doctor: 'Dr. Diallo', time: '13:15', type: 'Urgence Respi', status: 'Terminé' },
  { id: 'C-2024-399', patient: 'Liam O\'Connor', doctor: 'Dr. Faye', time: '11:45', type: 'Contrôle Post-Op', status: 'Terminé' },
  { id: 'C-2024-398', patient: 'Amina Osei', doctor: 'Dr. Diallo', time: '09:30', type: 'Fièvre persistante', status: 'Terminé' },
  { id: 'C-2024-397', patient: 'Zara Khan', doctor: 'Dr. Faye', time: '08:15', type: 'Admission', status: 'Terminé' },
];

export default function Consultations() {
  return (
    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Journal_Des_Consultations</h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Historique complet des actes médicaux • Service Pédiatrie
          </p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="relative group w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="RECHERCHER_ACTE..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 text-[10px] font-mono focus:outline-none focus:border-zinc-900 transition-all uppercase tracking-widest"
            />
          </div>
          <button className="px-6 py-3 border border-zinc-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-zinc-50 transition-all">
            <Filter className="w-4 h-4" /> Filtrer
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50/50 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
              <th className="px-10 py-5">ID_ACTE</th>
              <th className="px-10 py-5">PATIENT</th>
              <th className="px-10 py-5">PRATICIEN</th>
              <th className="px-10 py-5">TYPE_CONSULTATION</th>
              <th className="px-10 py-5">HEURE</th>
              <th className="px-10 py-5">STATUT</th>
              <th className="px-10 py-5 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {CONSULTATIONS_MOCK.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50/30 transition-colors group">
                <td className="px-10 py-6 border-l-2 border-transparent group-hover:border-zinc-900 transition-all">
                  <span className="text-[10px] font-mono font-bold text-zinc-400 tracking-widest">{c.id}</span>
                </td>
                <td className="px-10 py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-100 flex items-center justify-center rounded-none border border-zinc-200">
                      <User className="w-4 h-4 text-zinc-400" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">{c.patient}</span>
                  </div>
                </td>
                <td className="px-10 py-6 text-[11px] font-bold text-zinc-600 uppercase tracking-wide">{c.doctor}</td>
                <td className="px-10 py-6 text-xs text-zinc-500 font-medium">{c.type}</td>
                <td className="px-10 py-6">
                   <div className="flex items-center gap-2 text-zinc-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono uppercase font-bold">{c.time}</span>
                   </div>
                </td>
                <td className="px-10 py-6">
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm",
                    c.status === 'En cours' ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-green-100 text-green-700"
                  )}>
                    {c.status}
                  </span>
                </td>
                <td className="px-10 py-6 text-right">
                  <button className="text-zinc-300 hover:text-zinc-900 transition-colors">
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-8 bg-zinc-50/50 border-t border-zinc-100 flex justify-between items-center px-10">
           <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
              Affichage de 5 consultations récentes
           </p>
           <button className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900 underline underline-offset-4">
              Voir tout l'historique →
           </button>
        </div>
      </div>
    </div>
  );
}
