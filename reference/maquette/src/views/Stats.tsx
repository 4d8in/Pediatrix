import React from 'react';
import { 
  Users, 
  Bed, 
  Clock, 
  TrendingUp, 
  Download, 
  Lock,
  LockKeyhole,
  Info,
  BarChart3,
  Calendar,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { cn } from '../lib/utils';

interface StatsProps {
  userRole?: string;
}

export default function Stats({ userRole = 'Infirmière' }: StatsProps) {
  // Only Doctor or Directeur can see the stats
  const isAuthorized = userRole.includes('Médecin') || userRole.includes('Directeur') || userRole.includes('Chef');

  const statCards = [
    { label: "Consultations ce mois", value: '42', icon: BarChart3, color: 'blue' },
    { label: "Taux d'hospitalisation", value: '19%', sub: 'Seuil: 15%', icon: Bed, color: 'amber', alert: true },
    { label: "Durée moyenne de séjour", value: '4.2 j', sub: '-0.3j vs mars', icon: Clock, color: 'blue' },
    { label: "Lits occupés", value: '8/12', sub: '67% occupation', icon: TrendingUp, color: 'blue' },
  ];

  const pathologyData = [
    { name: 'Paludisme', value: 18, color: '#1A6FD4' },
    { name: 'IRA/Pneumonie', value: 9, color: '#1A6FD4' },
    { name: 'Malnutrition', value: 6, color: '#1A6FD4' },
    { name: 'Diarrhée aiguë', value: 5, color: '#1A6FD4' },
    { name: 'Drépanocytose', value: 4, color: '#1A6FD4' },
  ];

  const workload = [
    { name: 'Dr. Moussa Diallo', consultations: 28, hospitalises: 5 },
    { name: 'Dr. Aminata Camara', consultations: 14, hospitalises: 3 },
  ];

  if (!isAuthorized) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 bg-white/40 backdrop-blur-md relative overflow-hidden">
        <div className="absolute inset-0 bg-white/30 backdrop-blur-sm z-0"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-zinc-100 border-2 border-zinc-200 rounded-full flex items-center justify-center mb-8 shadow-xl">
            <LockKeyhole className="w-8 h-8 text-zinc-400" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-[0.2em] text-zinc-900 mb-4">Accès_Restreint</h1>
          <p className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest text-center max-w-sm leading-relaxed">
            Statistiques du service — Accès réservé au chef de service ou au corps médical autorisé.
          </p>
          <div className="mt-12 h-px w-24 bg-zinc-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 space-y-10 font-sans bg-zinc-50/50 min-h-full pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-zinc-900 flex items-center justify-center text-white text-[10px] font-black">ST</div>
             <h1 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-900">Statistiques_Du_Service</h1>
          </div>
          <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 w-fit flex items-center gap-2">
             <Info className="w-3.5 h-3.5 text-blue-600" />
             <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Données agrégées et anonymisées — Service Pédiatrie</span>
          </div>
        </div>

        <button className="bg-white border-2 border-zinc-900 text-zinc-900 px-6 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center gap-3 shadow-[4px_4px_0px_#18181b]">
          <Download className="w-4 h-4" /> Exporter le rapport avril 2025 — PDF
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white border border-zinc-200 p-8 shadow-sm group hover:border-zinc-900 transition-all relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
               <div className={cn(
                 "p-3 rounded-none transition-all",
                 card.color === 'blue' ? "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white" : "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white"
               )}>
                 <card.icon className="w-5 h-5" />
               </div>
               {card.alert && (
                 <ArrowUpRight className="w-4 h-4 text-amber-500 animate-pulse" />
               )}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{card.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-zinc-900">{card.value}</span>
                {card.sub && <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">{card.sub}</span>}
              </div>
            </div>
            {/* Minimalist chart decoration */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-100">
               <div 
                 className={cn(
                   "h-full", 
                   card.color === 'blue' ? "bg-blue-600" : "bg-amber-500"
                 )} 
                 style={{ width: card.label.includes('Lits') ? '67%' : '100%' }}
               ></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {/* Top Pathologies */}
        <div className="bg-white border border-zinc-200 p-8 shadow-sm">
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900 flex items-center gap-3">
               <span className="w-8 h-px bg-zinc-900"></span>
               Top_Pathologies_Avril_2025
             </h3>
             <Calendar className="w-4 h-4 text-zinc-200" />
           </div>

           <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pathologyData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#18181b' }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ fontSize: '10px', border: 'none', background: '#18181b', color: '#fff', borderRadius: '0' }}
                  />
                  <Bar dataKey="value" radius={[0, 2, 2, 0]} barSize={24}>
                    {pathologyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={1 - index * 0.15} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Workload Table */}
        <div className="bg-white border border-zinc-200 shadow-sm flex flex-col">
           <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900 flex items-center gap-3">
                <span className="w-8 h-px bg-zinc-900"></span>
                Charge_De_Travail_Praticiens
              </h3>
           </div>
           <div className="p-0 flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50/50">
                  <tr>
                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Médecin</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center">Consultations</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Hospitalisés</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {workload.map((doc, i) => (
                    <tr key={i} className="hover:bg-zinc-50/30 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-zinc-900 uppercase tracking-tight">{doc.name}</span>
                          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">PÉDIATRE</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="text-xl font-black text-zinc-900">{doc.consultations}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex items-center justify-end gap-2 text-zinc-900">
                           <span className="text-xl font-black">{doc.hospitalises}</span>
                           <div className="flex gap-0.5">
                             {[...Array(5)].map((_, j) => (
                               <div key={j} className={cn("w-1.5 h-3", j < doc.hospitalises ? "bg-blue-600" : "bg-zinc-100")}></div>
                             ))}
                           </div>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
           <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex items-center gap-3 text-zinc-400">
              <Info className="w-3.5 h-3.5" />
              <p className="text-[9px] font-mono uppercase tracking-widest italic">Mise à jour en temps réel — Dernier relevé: 14:32</p>
           </div>
        </div>
      </div>
    </div>
  );
}
