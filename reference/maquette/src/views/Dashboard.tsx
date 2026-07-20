import React from 'react';
import { 
  Users, 
  Clock, 
  FlaskConical, 
  AlertCircle,
  Plus,
  ChevronRight,
  Stethoscope,
  Bed,
  Bell,
  Activity,
  QrCode,
  Camera,
  Search,
  ArrowRight,
  Printer,
  FileCheck,
  CheckSquare,
  Square
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  emergencyAlert?: {
    isActive: boolean;
    patientId: string | null;
    patientName: string | null;
    isResolved: boolean;
    resolvedTime: string | null;
  };
}

export default function Dashboard({ emergencyAlert }: DashboardProps) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [patientSearch, setPatientSearch] = React.useState('');
  const [selectedPatients, setSelectedPatients] = React.useState<string[]>([]);
  
  const stats = [
    { label: "Patients en charge", value: '8', icon: Users, color: 'blue' },
    { label: "Paramètres vitaux à prendre", value: '4', icon: Activity, color: 'amber' },
    { label: "Hospitalisés", value: '5', icon: Bed, color: 'blue' },
  ];

  const patients = [
    { name: 'Amadou Bah', age: '4 ans', admission: '17/04', motif: 'Fièvre', status: 'Hospitalisé', statusColor: 'blue' },
    { name: 'Fatimata Sy', age: '2 ans', admission: '18/04', motif: 'Toux', status: 'En consultation', statusColor: 'green' },
    { name: 'Ibrahima Diop', age: '7 ans', admission: '18/04', motif: 'Diarrhée', status: 'En attente', statusColor: 'gray' },
  ];

  const toggleSelect = (name: string) => {
    setSelectedPatients(prev => 
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  const selectAll = () => {
    if (selectedPatients.length === patients.length) setSelectedPatients([]);
    else setSelectedPatients(patients.map(p => p.name));
  };

  return (
    <div className="p-10 space-y-8 relative z-10 transition-all duration-500 animate-in fade-in">
      {/* Header with Quick Action */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-900 flex items-center gap-3">
            <span className="w-8 h-px bg-zinc-900"></span>
            Tableau_de_Bord_Infirmier
          </h1>
        </div>
        <button className="bg-[#22C55E] text-white px-6 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-[#16a34a] transition-all shadow-lg shadow-green-500/10 flex items-center gap-3">
          <Plus className="w-4 h-4" /> Saisir paramètres vitaux
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white border border-zinc-200 p-8 shadow-sm flex items-center gap-6 group hover:border-zinc-900 transition-all">
            <div className={cn(
              "w-12 h-12 flex items-center justify-center transition-colors",
              stat.color === 'amber' ? "bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white" : "bg-zinc-50 text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white"
            )}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{stat.label}</p>
              <p className="text-3xl font-black text-zinc-900 font-mono tracking-tighter">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* DASHBOARD SEARCH & SCANNER */}
      <div className="space-y-4 max-w-4xl">
        <div className="flex gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
            <input 
              type="text" 
              placeholder="RECHERCHER_PATIENT_OU_ID..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 outline-none focus:border-zinc-900 font-bold text-xs uppercase tracking-widest transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsScanning(!isScanning)}
            className={cn(
              "px-6 py-4 border flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all",
              isScanning ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-900 border-zinc-200 hover:border-zinc-900"
            )}
          >
            <QrCode className="w-4 h-4" /> Scanner
          </button>
        </div>

        {isScanning && (
          <div className="bg-zinc-100 border-2 border-dashed border-zinc-200 p-10 animate-in fade-in slide-in-from-top-4">
            <div className="max-w-sm mx-auto flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-zinc-200 flex items-center justify-center rounded-2xl relative overflow-hidden">
                <Camera className="w-8 h-8 text-zinc-400" />
                <div className="absolute inset-0 border-2 border-zinc-900/10 animate-pulse"></div>
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/30 -translate-y-1/2"></div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-900">Scan_En_Cours...</p>
                <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Pointez la caméra vers le QR code du patient</p>
              </div>
              
              <div className="w-full space-y-4 pt-4 border-t border-zinc-200">
                <div className="space-y-2">
                   <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Saisir l'ID manuellement</label>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       placeholder="PED-XXXX-XXXX"
                       className="flex-1 bg-white border border-zinc-200 p-2 text-[10px] font-mono outline-none focus:border-zinc-900"
                     />
                     <button className="bg-zinc-900 text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">OK</button>
                   </div>
                </div>

                <div 
                  className="p-4 bg-blue-50 border border-blue-100 flex items-start gap-4 text-left cursor-pointer hover:bg-blue-100 transition-all group"
                  onClick={() => {
                    setPatientSearch('Amadou Bah PED-2024-00412');
                    setIsScanning(false);
                  }}
                >
                  <div className="p-2 bg-blue-600 text-white rounded-lg">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Démo: Scan réussi</p>
                    <p className="text-[11px] font-bold text-blue-900">Amadou Bah (PED-2024-00412)</p>
                    <div className="mt-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600 group-hover:underline">
                      Ouvrir le dossier <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alert Banner */}
      <div className="bg-[#FFF8E6] border border-amber-100 p-5 flex items-center justify-between group cursor-pointer hover:bg-amber-50 transition-colors">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-amber-200 text-amber-700">
            <Bell className="w-4 h-4 fill-amber-700" />
          </div>
          <p className="text-[12px] font-bold text-amber-900">
            📬 Résultats reçus — <span className="font-black">Amadou Bah</span> — <span className="font-mono">NFS + Goutte épaisse</span> → <span className="underline">Cliquer pour consulter</span>
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
      </div>

      {/* Patient List Table */}
      <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Patients_Récents</h2>
          <div className="h-0.5 w-12 bg-zinc-200"></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-50">
                <th className="px-8 py-4 w-10">
                   <button onClick={selectAll} className="text-zinc-300 hover:text-zinc-600">
                      {selectedPatients.length === patients.length ? <CheckSquare className="w-4 h-4 text-zinc-900" /> : <Square className="w-4 h-4" />}
                   </button>
                </th>
                <th className="px-8 py-4">Nom</th>
                <th className="px-8 py-4">Âge</th>
                <th className="px-8 py-4">Admission</th>
                <th className="px-8 py-4">Motif</th>
                <th className="px-8 py-4">Statut</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {patients.map((patient, i) => {
                const isEmergency = patient.name === 'Amadou Bah' && emergencyAlert?.isActive;
                const isRecentResolved = patient.name === 'Amadou Bah' && emergencyAlert?.isResolved;

                return (
                  <tr 
                    key={i} 
                    className={cn(
                      "hover:bg-zinc-50/30 transition-colors group",
                      isEmergency && "bg-red-50/50",
                      selectedPatients.includes(patient.name) && "bg-blue-50/30"
                    )}
                  >
                    <td className="px-8 py-5">
                       <button 
                         onClick={() => toggleSelect(patient.name)}
                         className={cn(
                           "transition-colors",
                           selectedPatients.includes(patient.name) ? "text-zinc-900" : "text-zinc-200 group-hover:text-zinc-400"
                         )}
                       >
                          {selectedPatients.includes(patient.name) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                       </button>
                    </td>
                    <td className="px-8 py-5 relative">
                      {isEmergency && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 animate-pulse"></div>}
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-black uppercase tracking-tight text-zinc-900">{patient.name}</span>
                        {isEmergency && (
                          <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-none animate-pulse">URGENCE ACTIVE</span>
                        )}
                        {isRecentResolved && (
                          <span className="bg-green-500 text-white text-[8px] font-black px-2 py-0.5 rounded-none">Urgence résolue — {emergencyAlert.resolvedTime}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs text-zinc-500 font-medium">{patient.age}</td>
                  <td className="px-8 py-5 text-[10px] font-mono text-zinc-400">{patient.admission}</td>
                  <td className="px-8 py-5 text-xs text-zinc-600 font-medium uppercase tracking-wide">{patient.motif}</td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 text-[9px] font-black uppercase tracking-widest",
                      patient.statusColor === 'blue' ? "bg-blue-50 text-blue-700 border border-blue-100" :
                      patient.statusColor === 'green' ? "bg-green-50 text-green-700 border border-green-100" :
                      "bg-zinc-100 text-zinc-500 border border-zinc-200"
                    )}>
                      {patient.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-zinc-300 hover:text-[#1A6FD4] transition-colors p-2">
                       <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
        <div className="p-8 border-t border-zinc-100 bg-zinc-50/30 text-center">
           <button className="text-[10px] font-black uppercase tracking-widest text-[#1A6FD4] hover:underline">
             Voir tous les patients →
           </button>
        </div>
      </div>

      {/* BATCH ACTIONS BAR */}
      <AnimatePresence>
        {selectedPatients.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900 text-white px-10 py-5 shadow-2xl flex items-center gap-10 border border-white/5"
          >
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 flex items-center justify-center font-black text-xs">
                   {selectedPatients.length}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Patients Sélectionnés</span>
             </div>
             
             <div className="h-10 w-px bg-white/10"></div>
             
             <div className="flex gap-4">
                <button className="flex items-center gap-3 px-6 py-3 bg-white text-zinc-900 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
                   <Printer className="w-4 h-4" /> Impression en lot
                </button>
                <button className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                   <FileCheck className="w-4 h-4" /> Valider décharge
                </button>
                <button 
                  onClick={() => setSelectedPatients([])}
                  className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white"
                >
                   Annuler ×
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
