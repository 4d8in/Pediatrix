import React from 'react';
import { TrendingUp, Users, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

const GROWTH_DATA_MOCK = [
  { month: 'Jan', underweight: 12, normal: 78, overweight: 10 },
  { month: 'Feb', underweight: 15, normal: 75, overweight: 10 },
  { month: 'Mar', underweight: 10, normal: 80, overweight: 10 },
  { month: 'Apr', underweight: 8, normal: 82, overweight: 10 },
];

export default function Growth() {
  return (
    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Analyse_De_La_Croissance</h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Statistiques nutritionnelles & Indicateurs de développement
          </p>
        </div>
        
        <div className="flex gap-4">
           <button className="px-6 py-3 border-2 border-zinc-900 text-zinc-900 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center gap-3">
              Export CSV
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {[
          { label: 'Indice Poids/Âge Moyen', value: '0.85', trend: 'up', color: 'text-zinc-900' },
          { label: 'Taux de Malnutrition', value: '8.2%', trend: 'down', color: 'text-red-600' },
          { label: 'Patients suivis (Actifs)', value: '142', trend: 'up', color: 'text-zinc-400' }
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-zinc-200 p-8 flex flex-col gap-4 group hover:border-zinc-900 transition-all">
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">{stat.label}</span>
             <div className="flex items-baseline gap-4">
                <span className={cn("text-3xl font-black italic", stat.color)}>{stat.value}</span>
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-black",
                  stat.trend === 'up' ? "text-green-600" : "text-red-600"
                )}>
                   {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                   {stat.trend === 'up' ? '+2.4%' : '-1.8%'}
                </div>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         <div className="bg-white border border-zinc-200 p-10 space-y-8">
            <div className="flex items-center justify-between">
               <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Évolution_Statut_Nutritionnel</h2>
               <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-[#1A6FD4]"></div>
                     <span className="text-[9px] font-black uppercase text-zinc-400 font-mono">Normal</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-red-500"></div>
                     <span className="text-[9px] font-black uppercase text-zinc-400 font-mono">Insuffisant</span>
                  </div>
               </div>
            </div>
            
            <div className="h-80 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={GROWTH_DATA_MOCK}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                     <XAxis 
                       dataKey="month" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600 }} 
                     />
                     <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600 }} 
                     />
                     <Tooltip 
                       contentStyle={{ border: 'none', backgroundColor: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', borderRadius: '0' }}
                       labelStyle={{ fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px' }}
                     />
                     <Area type="monotone" dataKey="normal" stackId="1" stroke="#1A6FD4" fill="#1A6FD4" fillOpacity={0.1} strokeWidth={3} />
                     <Area type="monotone" dataKey="underweight" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeWidth={3} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="space-y-8">
            <div className="bg-zinc-900 text-white p-10 space-y-8">
               <div className="flex items-center gap-4 text-amber-500">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest">Zones_D_Alerte_Identifiées</h3>
               </div>
               <div className="space-y-6">
                  {[
                    { zone: 'Quartier C', issue: 'Hausse 15% Malnutrition aigüe', p: 'HIGH' },
                    { zone: 'Secteur 4', issue: 'Retards de croissance suspects', p: 'MEDIUM' }
                  ].map(alert => (
                    <div key={alert.zone} className="border-l-2 border-white/10 pl-6 py-2 space-y-1 group hover:border-amber-500 transition-all cursor-crosshair">
                       <span className="text-[11px] font-black uppercase tracking-tight">{alert.zone}</span>
                       <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest">{alert.issue}</p>
                    </div>
                  ))}
               </div>
               <button className="w-full py-4 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                  Déployer enquête nutritionnelle
               </button>
            </div>

            <div className="bg-white border border-zinc-200 p-8 flex items-center gap-6">
               <div className="p-4 bg-zinc-50 border border-zinc-100 italic font-serif text-3xl text-zinc-900">
                  "Nutrition c'est l'avenir."
               </div>
               <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Conseil_Du_Jour</p>
                  <p className="text-[10px] font-bold text-zinc-600 leading-tight">
                     Privilégier le suivi systématique du périmètre brachial (MUAC).
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
