import React, { useState } from 'react';
import { 
  Search, 
  Clock, 
  FlaskConical, 
  Droplet, 
  AlertTriangle,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LabRequest {
  id: string;
  testName: string;
  patientName: string;
  age: string;
  mrn: string;
  time: string;
  priority: 'STAT' | 'ROUTINE';
  type: 'Blood' | 'Urine';
  doctor: string;
}

const REQUESTS: LabRequest[] = [
  { 
    id: '1', 
    testName: 'CBC + Differential', 
    patientName: 'Liam O\'Connor', 
    age: '4y', 
    mrn: '98234', 
    time: '10m ago', 
    priority: 'STAT', 
    type: 'Blood', 
    doctor: 'Dr. Sarah Jenkins' 
  },
  { 
    id: '2', 
    testName: 'Comprehensive Metabolic Panel', 
    patientName: 'Maya Patel', 
    age: '7y', 
    mrn: '44219', 
    time: '45m ago', 
    priority: 'ROUTINE', 
    type: 'Blood', 
    doctor: 'Dr. Robert Chen' 
  },
  { 
    id: '3', 
    testName: 'Urinalysis', 
    patientName: 'Elijah Wood', 
    age: '11y', 
    mrn: '11092', 
    time: '2h ago', 
    priority: 'ROUTINE', 
    type: 'Urine', 
    doctor: 'Dr. Sarah Jenkins' 
  }
];

export default function Lab() {
  const [selectedRequestId, setSelectedRequestId] = useState('1');

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 relative z-10">
      {/* Left Panel: Pending Requests */}
      <div className="w-1/3 border-r border-zinc-200 bg-white flex flex-col h-full shadow-sm z-10">
        <div className="p-8 border-b border-zinc-100 bg-zinc-50/30">
          <h2 className="text-[10px] font-bold text-zinc-900 uppercase tracking-[0.3em] mb-6">Requêtes_En_Attente</h2>
          <div className="flex gap-4">
             <button className="bg-zinc-900 text-white px-4 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all">Tous (12)</button>
             <button className="bg-white border border-zinc-200 text-zinc-400 px-4 py-1.5 text-[8px] font-black uppercase tracking-widest hover:border-zinc-900 hover:text-zinc-900 transition-all">STAT (3)</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {REQUESTS.map((req) => (
            <div 
              key={req.id}
              onClick={() => setSelectedRequestId(req.id)}
              className={cn(
                "p-6 border transition-all cursor-pointer relative group",
                selectedRequestId === req.id 
                  ? "border-zinc-900 bg-zinc-50" 
                  : "border-zinc-100 hover:border-zinc-300"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                   <span className={cn(
                     "px-2 py-0.5 text-[8px] font-black tracking-widest uppercase mb-2 inline-block border",
                     req.priority === 'STAT' ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
                   )}>
                     {req.priority}
                   </span>
                   <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-tight line-clamp-1">{req.testName}</h3>
                </div>
                <span className="text-[8px] text-zinc-400 font-mono font-bold">{req.time}</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mb-4">
                <span className="font-bold text-zinc-900">{req.patientName}</span> • MRN: {req.mrn}
              </p>
              <div className="flex items-center text-[8px] font-mono text-zinc-400 gap-3 border-t border-zinc-100 pt-3">
                {req.type.toUpperCase()} // RESPONSABLE: {req.doctor.split(' ').pop()?.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel: Detailed Result Entry */}
      <div className="flex-1 overflow-y-auto p-12 bg-zinc-50 relative">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-zinc-200">
            <div>
              <h1 className="text-2xl font-black text-zinc-900 uppercase tracking-[0.2em] mb-3">Hematology_Report_A1</h1>
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Accession: LAB-2023-0892 // Timestamp: 09:15:00</p>
            </div>
            <div className="flex gap-4">
              <button className="px-8 py-3 bg-white border border-zinc-200 text-zinc-900 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-50 transition-all font-black">
                ENREGISTRER
              </button>
              <button className="px-8 py-3 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all font-black">
                SOUMETTRE_POUR_VERIF
              </button>
            </div>
          </div>

          {/* Patient Context Banner */}
          <div className="bg-white border border-zinc-200 p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-900"></div>
            <div className="flex items-center gap-8">
              <div className="w-16 h-16 bg-zinc-50 flex items-center justify-center text-zinc-900 font-black text-2xl border border-zinc-200">
                LO
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900 uppercase tracking-tight">Liam O'Connor</h3>
                <div className="flex flex-wrap gap-x-8 gap-y-1 text-[10px] font-mono text-zinc-400 mt-2 font-bold uppercase tracking-widest">
                  <span>DOB: 04.12.2019</span>
                  <span>MRN: 98234</span>
                  <span className="text-zinc-900">Loc: PEDS-ICU</span>
                </div>
              </div>
            </div>
            <div className="text-right border-l border-zinc-100 pl-8 hidden md:block">
              <div className="text-zinc-900 font-black tracking-[0.3em] text-[10px] uppercase">
                URGENCE_STAT
              </div>
              <div className="text-[8px] text-zinc-400 mt-2 font-mono uppercase">DR_JENKINS_S</div>
            </div>
          </div>

          {/* Data Entry Table */}
          <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
            <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-200 flex justify-between items-center">
               <h3 className="font-bold text-zinc-900 text-[10px] uppercase tracking-[0.3em]">Hématologie_RBC_Index</h3>
               <span className="text-[8px] text-zinc-400 font-mono tracking-widest uppercase">Specimen: <span className="text-zinc-900 font-bold">EDTA_WHOLE_BLOOD</span></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-black border-b border-zinc-200">
                    <th className="py-5 px-8 w-1/3">NOM_PARAMETRE</th>
                    <th className="py-5 px-8 w-1/4">RESULTAT</th>
                    <th className="py-5 px-8 w-1/6">UNITES</th>
                    <th className="py-5 px-8 w-1/4">INTERVALLE_REF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-5 px-8 text-xs font-bold uppercase tracking-tight">RBC Count</td>
                    <td className="py-5 px-8">
                      <input 
                        type="text" 
                        defaultValue="4.8"
                        className="w-24 px-4 py-2 border border-zinc-200 bg-zinc-50 text-xs font-black text-center focus:border-zinc-900 outline-none transition-all"
                      />
                    </td>
                    <td className="py-5 px-8 text-[10px] font-mono text-zinc-400">x10^6/µl</td>
                    <td className="py-5 px-8 text-[10px] font-mono text-zinc-300">4.0 - 5.2</td>
                  </tr>
                  <tr className="bg-zinc-900/5 transition-all">
                    <td className="py-5 px-8">
                       <div className="text-xs font-black text-zinc-900 uppercase tracking-tight">Hemoglobin (Hgb)</div>
                       <div className="text-[8px] text-zinc-400 font-mono font-bold mt-1 uppercase tracking-widest">
                          [Statut: Alerte_Niveau_Bas]
                       </div>
                    </td>
                    <td className="py-5 px-8">
                       <input 
                        type="text" 
                        defaultValue="9.2"
                        className="w-24 px-4 py-2 border-2 border-zinc-900 bg-white text-xs font-black text-center outline-none transition-all"
                      />
                    </td>
                    <td className="py-5 px-8 text-xs font-black text-zinc-900">g/dL</td>
                    <td className="py-5 px-8 text-[10px] font-mono text-zinc-300">11.5 - 13.5</td>
                  </tr>
                  <tr className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-5 px-8 text-xs font-bold uppercase tracking-tight">Hematocrit (Hct)</td>
                    <td className="py-5 px-8">
                      <input 
                        type="text" 
                        defaultValue="34.5"
                        className="w-24 px-4 py-2 border border-zinc-200 bg-zinc-50 text-xs font-black text-center focus:border-zinc-900 outline-none transition-all"
                      />
                    </td>
                    <td className="py-5 px-8 text-[10px] font-mono text-zinc-400 font-medium">%</td>
                    <td className="py-5 px-8 text-[10px] font-mono text-zinc-300">34.0 - 40.0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white border border-zinc-200 p-8 shadow-sm">
             <label className="text-[10px] font-black text-zinc-900 uppercase tracking-[0.3em] block mb-6">Annotations_Labo_Interne</label>
             <textarea 
               className="w-full h-32 p-6 border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-900 transition-all text-xs text-zinc-900 outline-none resize-none font-medium uppercase tracking-widest placeholder:text-zinc-200"
               placeholder="Saisir observations cliniques ici..."
             ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}
