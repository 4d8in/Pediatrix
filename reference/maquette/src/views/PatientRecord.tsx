import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Thermometer, 
  Activity, 
  Weight, 
  Clock, 
  FlaskConical, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  History,
  Stethoscope,
  Syringe,
  BarChart2,
  Lock,
  Plus,
  ArrowRight,
  ClipboardCheck,
  Zap,
  ChevronRight,
  Wind,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Scale,
  Ruler,
  Trash2,
  Search,
  FileText,
  Save,
  Pill,
  QrCode,
  Printer,
  Mic
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';

type TabType = 'vitaux' | 'historique' | 'consultation' | 'prescriptions' | 'labo' | 'vaccins' | 'croissance' | 'stats';

interface PatientRecordProps {
  userRole?: 'Médecin' | 'Infirmière' | 'Technicien Labo' | 'Directeur' | 'Administrateur technique';
  emergencyAlert?: {
    isActive: boolean;
    patientId: string | null;
    patientName: string | null;
    isResolved: boolean;
    resolvedTime: string | null;
  };
  onTriggerEmergency?: () => void;
  onDismissEmergency?: () => void;
}

export default function PatientRecord({ 
  userRole = 'Infirmière', 
  emergencyAlert, 
  onTriggerEmergency, 
  onDismissEmergency 
}: PatientRecordProps) {
  const [activeTab, setActiveTab] = useState<TabType>('vitaux');
  const [vaccinsReviewed, setVaccinsReviewed] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDictating, setIsDictating] = useState<string | null>(null);
  const [safetyAlert, setSafetyAlert] = useState<{ type: 'Allergy' | 'Interaction', message: string } | null>(null);

  const isDoctor = userRole === 'Médecin' || userRole === 'Directeur';

  // Consultation State
  const [consultation, setConsultation] = useState({
    motif: "Fièvre persistante J+3, refus d'alimentation",
    examen: "Enfant léthargique, muqueuse légèrement sèche. Pas de signes de détresse respiratoire. Abdomen souple.",
    diagnostic: "Paludisme simple (en attente confirmation labo), suspicion anémie secondaire.",
    savedAt: "Enregistré à 10:15"
  });

  const [medications, setMedications] = useState([
    { id: 1, name: "Paracétamol Sirop", dosage: "5ml toutes les 6h", status: "Active" },
    { id: 2, name: "Artésunate Injectable", dosage: "60mg IV", status: "Active" },
    { id: 3, name: "SRO", dosage: "Ad libitum", status: "Active" },
  ]);

  const [newMed, setNewMed] = useState({ name: '', dosage: '' });
  const [isAddingMed, setIsAddingMed] = useState(false);

  // Vials data
  const vitals = {
    temp: { current: 38.9, history: [39.1, 38.9, 38.9] },
    fc: { current: 112, history: [110, 112, 112] },
    spo2: { current: 97, history: [96, 97, 97] },
    fr: { current: 28, history: [30, 28, 28] },
    weight: { current: 13.2, history: [13.2, 13.2, 13.2] }
  };

  // Vaccination data
  const vaccinations = [
    { label: "BCG", dose: "1/1", date: "12/01/2021", next: "—", status: "À jour", color: "green" },
    { label: "Polio oral", dose: "4/4", date: "03/06/2022", next: "—", status: "À jour", color: "green" },
    { label: "Pentavalent", dose: "3/3", date: "03/06/2022", next: "—", status: "À jour", color: "green" },
    { label: "Rougeole", dose: "1/2", date: "15/09/2022", next: "15/09/2024", status: "En retard", color: "red" },
    { label: "Fièvre jaune", dose: "1/1", date: "15/09/2022", next: "—", status: "À jour", color: "green" },
    { label: "Méningite", dose: "0/1", date: "—", next: "À planifier", status: "Non fait", color: "amber" },
  ];

  // Growth data for Recharts
  const growthData = [
    { age: 0, p3: 2.5, p15: 2.9, p50: 3.5, p85: 4.2, p97: 4.8, patient: 3.4 },
    { age: 1, p3: 7.0, p15: 8.2, p50: 9.6, p85: 11.0, p97: 12.0, patient: 9.2 },
    { age: 2, p3: 9.4, p15: 10.8, p50: 12.2, p85: 14.0, p97: 15.5, patient: 11.8 },
    { age: 3, p3: 11.3, p15: 12.7, p50: 14.3, p85: 16.5, p97: 18.2 },
    { age: 4, p3: 12.7, p15: 14.4, p50: 16.3, p85: 18.8, p97: 21.0, patient: 12.8 },
    { age: 4.6, p3: 13.5, p15: 15.2, p50: 17.5, p85: 20.2, p97: 22.8, patient: 13.2 },
    { age: 5, p3: 14.1, p15: 16.0, p50: 18.3, p85: 21.5, p97: 24.5 },
  ];

  const heightData = [
    { age: 0, p3: 45, p15: 47, p50: 50, p85: 53, p97: 55, patient: 49 },
    { age: 1, p3: 69, p15: 72, p50: 76, p85: 80, p97: 82, patient: 74 },
    { age: 2, p3: 80, p15: 84, p50: 88, p85: 92, p97: 95, patient: 86 },
    { age: 4, p3: 91, p15: 96, p50: 102, p85: 108, p97: 112, patient: 97 },
    { age: 4.6, p3: 94, p15: 99, p50: 106, p85: 112, p97: 116, patient: 98 },
    { age: 5, p3: 98, p15: 104, p50: 110, p85: 116, p97: 120 },
  ];

  const measurementHistory = [
    { date: "18/04/2025", weight: "13.2 kg", height: "98 cm", author: "Inf. Fatou Sow" },
    { date: "15/03/2025", weight: "12.8 kg", height: "97 cm", author: "Inf. Fatou Sow" },
    { date: "10/01/2025", weight: "12.1 kg", height: "95 cm", author: "Dr. Moussa Diallo" },
  ];

  const tabs: { id: TabType; label: string; locked?: boolean }[] = [
    { id: 'vitaux', label: 'Paramètres vitaux' },
    { id: 'historique', label: 'Historique' },
    { id: 'consultation', label: 'Consultation', locked: !isDoctor },
    { id: 'prescriptions', label: 'Prescriptions', locked: !isDoctor },
    { id: 'labo', label: 'Résultats labo' },
    { id: 'vaccins', label: 'Vaccinations' },
    { id: 'croissance', label: 'Croissance' },
    { id: 'stats', label: 'Statistiques', locked: userRole !== 'Directeur' && userRole !== 'Médecin' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans pb-20">
      {/* STATIONARY HEADER - Always Visible */}
      <header className="sticky top-0 z-[100] bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6 md:px-10 md:py-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
              <div className="flex items-baseline gap-4 mb-1">
                <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Amadou Bah</h1>
                <span className="text-lg font-medium text-zinc-500">4 ans 7 mois</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  ID: <span className="text-zinc-900">PED-2024-00412</span>
                  <button className="text-zinc-300 hover:text-zinc-900 transition-colors" title="QR code disponible — Cliquer pour imprimer">
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> 
                  Admis le 17/04/2025 08h15 — Lit P-07
                </span>
              </div>
            </div>

            <div className="flex flex-col md:items-end gap-4 shrink-0">
              <div className="flex items-center gap-6">
                <button 
                  onClick={onTriggerEmergency}
                  className={cn(
                    "px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-lg h-[44px] min-w-[140px] justify-center",
                    emergencyAlert?.isActive 
                      ? "bg-white border-2 border-red-600 text-red-600 animate-pulse" 
                      : "bg-red-600 text-white hover:bg-red-700"
                  )}
                >
                  <Activity className={cn("w-4 h-4", emergencyAlert?.isActive && "animate-bounce")} />
                  {emergencyAlert?.isActive ? "URGENCE ACTIVE" : "Urgence"}
                </button>

                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-red-100 text-red-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 border border-red-200">
                    <AlertCircle className="w-3.5 h-3.5" /> Allergie pénicilline
                  </span>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5" /> Malnutrition modérée
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 border border-blue-200">
                    <TrendingUp className="w-3.5 h-3.5" /> Paludisme en cours
                  </span>
                </div>
                <div className="h-12 w-12 border-2 border-zinc-200 flex items-center justify-center font-black text-xl text-zinc-900 bg-zinc-50">
                  A+
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PRE-CONSULTATION CHECKLIST */}
        <div className={cn(
          "px-6 py-2 md:px-10 border-y transition-colors",
          (vaccinsReviewed) ? "bg-green-50/50 border-green-100" : "bg-amber-50/50 border-amber-100"
        )}>
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Chip 1: Vitaux */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Vitaux saisis</span>
              </div>

              {/* Chip 2: Allergies */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Allergies vérifiées</span>
              </div>

              {/* Chip 3: Vaccins */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-4 h-4 rounded-full flex items-center justify-center",
                  vaccinsReviewed ? "bg-green-500" : "bg-zinc-200"
                )}>
                  {vaccinsReviewed ? (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  ) : (
                    <span className="text-[8px] font-black text-zinc-400">?</span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  vaccinsReviewed ? "text-zinc-900" : "text-zinc-400"
                )}>
                  Vaccins {vaccinsReviewed ? "vérifiés" : "Non vérifiés"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <p className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                vaccinsReviewed ? "text-green-700" : "text-amber-700"
              )}>
                {vaccinsReviewed ? "✅ Dossier prêt pour la consultation" : "⚠️ Actions requises avant la consultation"}
              </p>
              {!vaccinsReviewed && (
                <button 
                  onClick={() => {
                    setActiveTab('vaccins');
                    setVaccinsReviewed(true);
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-[#1A6FD4] hover:underline"
                >
                  Compléter maintenant →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* INTELLIGENT SUMMARY LINE */}
        <div className="bg-[#FFF8E6] border-y border-amber-100 px-6 py-3 md:px-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <p className="text-[12px] font-bold text-amber-900 tracking-tight">
                J+2 traitement antipaludéen — Hb <span className="font-mono">8.2 g/dL</span> ↓ — Fièvre persistante <span className="font-mono text-red-600">38.9°C</span> — Bilan labo reçu hier
              </p>
            </div>
            
            <button className="bg-[#1A6FD4] text-white px-5 py-2 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-md hover:bg-[#1559ab] transition-all shrink-0">
              <FlaskConical className="w-4 h-4" /> 📋 Examiner les résultats labo
            </button>
          </div>
        </div>

        {/* TAB BAR */}
        <nav className="max-w-7xl mx-auto px-6 md:px-10 overflow-x-auto flex items-center">
          <div className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'vaccins') setVaccinsReviewed(true);
                }}
                className={cn(
                  "py-4 text-[11px] font-black uppercase tracking-[0.15em] border-b-2 transition-all flex items-center gap-2 whitespace-nowrap",
                  activeTab === tab.id 
                    ? "text-[#1A6FD4] border-[#1A6FD4]" 
                    : "text-zinc-400 border-transparent hover:text-zinc-600"
                )}
              >
                {tab.label}
                {tab.locked && <Lock className="w-3 h-3 opacity-40" />}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-6 py-10 md:px-10 relative">
        <AnimatePresence mode="wait">
          {tabs.find(t => t.id === activeTab)?.locked ? (
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-40 flex flex-col items-center justify-center bg-zinc-50 border border-dashed border-zinc-200"
            >
               <div className="w-20 h-20 bg-white border-2 border-zinc-200 rounded-full flex items-center justify-center mb-8 shadow-xl">
                  <Lock className="w-8 h-8 text-zinc-400" />
               </div>
               <h3 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900 mb-4">AccÈs_RÉservÉ</h3>
               <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest text-center max-w-sm leading-relaxed">
                  Cette section est réservée aux praticiens autorisés (Médecins/Chefs de service). <br/>
                  Veuillez contacter l'administrateur pour plus d'informations.
               </p>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'vitaux' ? (
              <div className="space-y-10">
                <div className="flex items-center justify-between">
                   <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-900">Lectures_DerniÈres_24H</h2>
                   <div className="h-px bg-zinc-200 flex-1 mx-8"></div>
                   <span className="text-[10px] font-mono text-zinc-400 uppercase">Inf. Fatou Sow — 07h15</span>
                </div>

                <div className="bg-white border border-zinc-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50/50">
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">ParamÈtre</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Valeur_Actuelle</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Micro_Trend</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Historique [N-3]</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {/* Température */}
                      <tr>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-red-50 flex items-center justify-center text-red-500">
                                <Thermometer className="w-4 h-4" />
                             </div>
                             <span className="text-xs font-bold uppercase tracking-tight">Température</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <span className="text-2xl font-mono font-black text-red-600">38.9°C</span>
                           <span className="ml-2 text-red-600 font-black">↑</span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex gap-1 items-end h-8">
                             <div className="w-1.5 h-6 bg-zinc-100"></div>
                             <div className="w-1.5 h-4 bg-zinc-400"></div>
                             <div className="w-1.5 h-5 bg-red-500"></div>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-xs text-zinc-400">
                           39.1 → 38.9 → 38.9
                        </td>
                      </tr>

                      {/* Fréquence Cardiaque */}
                      <tr>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-zinc-50 flex items-center justify-center text-zinc-900">
                                <Activity className="w-4 h-4" />
                             </div>
                             <span className="text-xs font-bold uppercase tracking-tight text-zinc-900">Fréq. Cardiaque</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <span className="text-2xl font-mono font-black text-zinc-900">112 <span className="text-sm font-sans font-medium text-zinc-400">bpm</span></span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="font-mono text-[9px] text-zinc-400 font-black">STABLE</div>
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-xs text-zinc-400">
                           110 → 112 → 112
                        </td>
                      </tr>

                      {/* SpO2 */}
                      <tr>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-green-50 flex items-center justify-center text-green-600">
                                <Wind className="w-4 h-4" />
                             </div>
                             <span className="text-xs font-bold uppercase tracking-tight text-zinc-900">Saturation SpO2</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <span className="text-2xl font-mono font-black text-green-600">97%</span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="font-mono font-black text-green-600 text-[10px]">OPTIMAL</div>
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-xs text-zinc-400">
                           96 → 97 → 97
                        </td>
                      </tr>

                      {/* FR */}
                      <tr>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-zinc-50 flex items-center justify-center text-zinc-900">
                                <Activity className="w-4 h-4" />
                             </div>
                             <span className="text-xs font-bold uppercase tracking-tight text-zinc-900">Fréq. Resp</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <span className="text-2xl font-mono font-black text-zinc-900">28</span>
                           <span className="ml-2 text-xs font-sans text-zinc-400">/min</span>
                        </td>
                        <td className="px-8 py-6 italic text-[9px] text-zinc-300 uppercase tracking-widest font-black">N/A</td>
                        <td className="px-8 py-6 text-right font-mono text-xs text-zinc-400">
                           30 → 28 → 28
                        </td>
                      </tr>

                      {/* Poids */}
                      <tr>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-zinc-50 flex items-center justify-center text-zinc-900">
                                <Weight className="w-4 h-4" />
                             </div>
                             <span className="text-xs font-bold uppercase tracking-tight text-zinc-900">Poids</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <span className="text-2xl font-mono font-black text-zinc-900">13.2 <span className="text-sm font-sans font-medium text-zinc-400">kg</span></span>
                        </td>
                        <td className="px-8 py-6">
                           <TrendingDown className="w-4 h-4 text-amber-500" />
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-xs text-zinc-400">
                           13.2 → 13.2 → 13.2
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                       Données certifiés par validation biométrique
                    </p>
                    <button className="bg-zinc-900 text-white px-8 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all shadow-lg flex items-center gap-3">
                      <Plus className="w-4 h-4" /> Saisir nouveaux paramètres
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === 'consultation' || activeTab === 'prescriptions' ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 relative min-h-[600px]">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-900">Bloc_Consultation_Praticien</h2>
                  <div className="h-px bg-zinc-200 flex-1 mx-8"></div>
                  <div className="flex gap-4">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">{consultation.savedAt}</span>
                    <button className="bg-zinc-900 text-white px-4 py-1.5 text-[9px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center gap-2">
                      <Save className="w-3 h-3" /> Sauvegarder
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  {/* Left Column: Notepad */}
                  <div className="lg:col-span-7 space-y-8">
                    <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
                       <div className="p-6 bg-zinc-50 border-b border-zinc-100 flex items-center gap-3">
                         <FileText className="w-4 h-4 text-zinc-400" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Notes_Observations</span>
                       </div>
                       <div className="p-8 space-y-8">
                         <div className="space-y-3">
                           <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Motif d'hospitalisation / Plainte</label>
                              <button 
                                onClick={() => {
                                  setIsDictating('motif');
                                  setTimeout(() => setIsDictating(null), 3000);
                                }}
                                className={cn(
                                  "p-1.5 rounded-full transition-all",
                                  isDictating === 'motif' ? "bg-red-500 text-white animate-pulse" : "text-zinc-300 hover:text-zinc-600"
                                )}
                              >
                                <Mic className="w-3.5 h-3.5" />
                              </button>
                           </div>
                           <textarea 
                             value={consultation.motif}
                             onChange={(e) => setConsultation({...consultation, motif: e.target.value})}
                             className="w-full bg-zinc-50 border border-zinc-100 p-4 text-sm font-bold text-zinc-900 focus:outline-none focus:border-zinc-900 transition-all min-h-[80px]"
                             placeholder={isDictating === 'motif' ? "ÉCOUTE EN COURS..." : "Décrire le motif..."}
                           />
                         </div>
                         <div className="space-y-3">
                           <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Examen Clinique Structured</label>
                              <button 
                                onClick={() => {
                                  setIsDictating('examen');
                                  setTimeout(() => setIsDictating(null), 3000);
                                }}
                                className={cn(
                                  "p-1.5 rounded-full transition-all",
                                  isDictating === 'examen' ? "bg-red-500 text-white animate-pulse" : "text-zinc-300 hover:text-zinc-600"
                                )}
                              >
                                <Mic className="w-3.5 h-3.5" />
                              </button>
                           </div>
                           <textarea 
                             value={consultation.examen}
                             onChange={(e) => setConsultation({...consultation, examen: e.target.value})}
                             className="w-full bg-zinc-50 border border-zinc-100 p-4 text-sm font-bold text-zinc-900 focus:outline-none focus:border-zinc-900 transition-all min-h-[120px]"
                             placeholder={isDictating === 'examen' ? "ÉCOUTE EN COURS..." : "Détails de l'examen..."}
                           />
                         </div>
                         <div className="space-y-3">
                           <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Hypothèses Diagnostiques</label>
                              <button 
                                onClick={() => {
                                  setIsDictating('diagnostic');
                                  setTimeout(() => setIsDictating(null), 3000);
                                }}
                                className={cn(
                                  "p-1.5 rounded-full transition-all",
                                  isDictating === 'diagnostic' ? "bg-red-500 text-white animate-pulse" : "text-zinc-300 hover:text-zinc-600"
                                )}
                              >
                                <Mic className="w-3.5 h-3.5" />
                              </button>
                           </div>
                           <textarea 
                             value={consultation.diagnostic}
                             onChange={(e) => setConsultation({...consultation, diagnostic: e.target.value})}
                             className="w-full bg-blue-50/30 border border-blue-100/50 p-4 text-sm font-black text-[#1A6FD4] focus:outline-none focus:border-blue-300 transition-all min-h-[100px]"
                             placeholder={isDictating === 'diagnostic' ? "ÉCOUTE EN COURS..." : "Poser un diagnostic..."}
                           />
                         </div>
                       </div>
                       <div className="p-4 bg-zinc-50 border-t border-zinc-100 text-center">
                          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest italic">Sauvegarde automatique activée</span>
                       </div>
                    </div>
                  </div>

                  {/* Right Column: Prescriptions */}
                  <div className="lg:col-span-5 space-y-8">
                    <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-full">
                       <div className="p-6 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <Pill className="w-4 h-4 text-zinc-400" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Prescriptions_Actives</span>
                         </div>
                         <button 
                           onClick={() => setIsAddingMed(true)}
                           className="text-[#1A6FD4] font-black uppercase tracking-widest text-[10px] flex items-center gap-1.5 hover:underline"
                         >
                           <Plus className="w-3.5 h-3.5" /> Ajouter
                         </button>
                       </div>
                       
                       <div className="p-0 flex-1">
                         {isAddingMed && (
                           <div className="p-8 bg-blue-50 border-b border-blue-100 animate-in fade-in slide-in-from-top-2">
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-4">Nouvelle Prescription</h4>
                             <div className="space-y-4">
                               <input 
                                 type="text" 
                                 placeholder="NOM_DU_MÉDICAMENT"
                                 className="w-full bg-white border border-blue-200 p-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-blue-500"
                                 value={newMed.name}
                                 onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                               />
                               {safetyAlert && (
                                 <div className="p-4 bg-red-50 border border-red-100 flex items-center gap-3 animate-in fade-in zoom-in-95">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    <span className="text-[10px] font-black uppercase text-red-700 tracking-widest">{safetyAlert.message}</span>
                                 </div>
                               )}
                               <input 
                                 type="text" 
                                 placeholder="POSOLOGIE (ex: 5ml x 3/j)"
                                 className="w-full bg-white border border-blue-200 p-3 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-blue-500"
                                 value={newMed.dosage}
                                 onChange={(e) => setNewMed({...newMed, dosage: e.target.value})}
                               />
                               <div className="flex gap-2 pt-2">
                                 <button 
                                   onClick={() => {
                                     // Contraindication Guardrail logic
                                     if (newMed.name.toLowerCase().includes('amox') || newMed.name.toLowerCase().includes('peni')) {
                                       setSafetyAlert({ type: 'Allergy', message: 'ALERTE: PATIENT ALLERGIQUE À LA PÉNIDILLINE' });
                                       return;
                                     }
                                     if (newMed.name && newMed.dosage) {
                                       setMedications([...medications, { id: Date.now(), ...newMed, status: 'Active' }]);
                                       setNewMed({ name: '', dosage: '' });
                                       setSafetyAlert(null);
                                       setIsAddingMed(false);
                                     }
                                   }}
                                   className="bg-[#1A6FD4] text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                                 >Confirmer</button>
                                 <button 
                                   onClick={() => setIsAddingMed(false)}
                                   className="text-zinc-400 px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                                 >Annuler</button>
                               </div>
                             </div>
                           </div>
                         )}

                         <div className="divide-y divide-zinc-50">
                           {medications.map(med => (
                             <div key={med.id} className="p-8 flex items-center justify-between group hover:bg-zinc-50/50 transition-all">
                               <div className="space-y-1">
                                 <h4 className="text-sm font-black text-zinc-900 uppercase tracking-tight">{med.name}</h4>
                                 <div className="flex items-center gap-3">
                                   <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">{med.dosage}</span>
                                   <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                 </div>
                               </div>
                               <button 
                                 onClick={() => setMedications(medications.filter(m => m.id !== med.id))}
                                 className="opacity-0 group-hover:opacity-100 p-2 text-zinc-300 hover:text-red-500 transition-all"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                           ))}
                         </div>
                       </div>

                       <div className="p-8 mt-auto flex flex-col gap-6">
                         {isDoctor && (
                           <button 
                             onClick={() => setIsPrinting(true)}
                             className="w-full bg-white border-2 border-zinc-900 text-zinc-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center justify-center gap-3"
                           >
                             <Printer className="w-4 h-4" /> Imprimer l'ordonnance
                           </button>
                         )}
                         <div className="bg-red-50 border border-red-100 p-6 flex flex-col gap-3">
                            <div className="flex items-center gap-3 text-red-700">
                               <AlertTriangle className="w-4 h-4" />
                               <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">Alerte_Sécurité</span>
                            </div>
                            <p className="text-[10px] font-medium text-red-900/60 leading-relaxed uppercase tracking-tight">
                               Patient allergique à la <span className="font-black text-red-700">PÉNIXILLINE</span>. Éviter tout antibiotique de la famille des Bêta-lactamines.
                            </p>
                         </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Floating Lab Request Button */}
                <div className="fixed bottom-20 right-10 z-[110]">
                  <button className="bg-zinc-900 text-white px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-[8px_8px_0px_#1A6FD4] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-3">
                    <FlaskConical className="w-5 h-5" /> NOUVELLE_REQUÊTE_LABO
                  </button>
                </div>
              </div>
            ) : activeTab === 'labo' ? (
               <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-900">Derniers_RÉsultats_Labo</h2>
                    <div className="h-px bg-zinc-200 flex-1 mx-8"></div>
                  </div>
                  <div className="grid gap-6">
                    <div className="bg-white border border-zinc-200 p-8 flex items-center justify-between hover:border-zinc-900 transition-all cursor-pointer group">
                      <div className="flex items-center gap-8">
                        <div className="w-12 h-12 bg-zinc-900 text-white flex items-center justify-center">
                          <FlaskConical className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-tight text-zinc-900 mb-1">Analyse de Sang [NFS]</h4>
                          <div className="flex gap-4 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                             <span>Recu: 06/05/2025</span>
                             <span className="text-zinc-200">|</span>
                             <span className="text-zinc-600 font-black italic">Hb: 8.2 g/dL (Anémie)</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-6 h-6 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                    </div>
                  </div>
               </div>
            ) : activeTab === 'historique' ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-900">Journal_Des_ÉvÉnements_Cliniques</h2>
                  <div className="h-px bg-zinc-200 flex-1 mx-8"></div>
                </div>
                <div className="space-y-6">
                  {[
                    { date: 'Hier, 18:30', event: 'Administration Paracétamol Sirop 5ml', author: 'Inf. Fatou Sow', type: 'ADMIN' },
                    { date: 'Hier, 10:15', event: 'Consultation Dr. Moussa Diallo - Suspicion Paludisme', author: 'Dr. M. Diallo', type: 'DOC' },
                    { date: '06/05/2025', event: 'Réception résultats labo : Hb 8.2 g/dL', author: 'Système', type: 'LAB' },
                    { date: '05/05/2025', event: 'Admission Patient - Motif: Fièvre +++ / Convulsion simple', author: 'Adm. Bureau', type: 'ADMIN' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-6 items-start group">
                      <div className="w-24 shrink-0 text-right">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">{item.date}</span>
                      </div>
                      <div className="relative pt-1 pb-4 flex-1">
                        <div className="absolute left-[-13px] top-2 w-1.5 h-1.5 rounded-full bg-zinc-200 group-hover:bg-zinc-900 transition-colors"></div>
                        <div className="absolute left-[-10px] top-4 bottom-0 w-px bg-zinc-100"></div>
                        <div className="bg-white border border-zinc-100 p-5 shadow-sm group-hover:border-zinc-200 transition-all">
                          <p className="text-xs font-black uppercase tracking-tight text-zinc-900 mb-2">{item.event}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                               <div className={cn(
                                 "w-1 h-1 rounded-full",
                                 item.type === 'DOC' ? "bg-blue-500" : item.type === 'LAB' ? "bg-amber-500" : "bg-zinc-400"
                               )}></div>
                               Saisi par: {item.author}
                            </span>
                            <button className="text-[9px] font-black uppercase tracking-widest text-[#1A6FD4] opacity-0 group-hover:opacity-100 transition-opacity">Voir détails</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'vaccins' ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-900">Calendrier_Vaccinal_PEV — Amadou Bah</h2>
                  <div className="h-px bg-zinc-200 flex-1 mx-8"></div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">4 ans 7 mois</span>
                </div>

                {/* Alert Banner */}
                <div className="bg-red-50 border border-red-100 p-6 flex items-center gap-4">
                  <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                  <p className="text-sm font-bold text-red-700 tracking-tight flex-1">
                    🔴 Rappel rougeole en retard depuis 7 mois — <span className="underline cursor-pointer">Planifier dès maintenant</span>
                  </p>
                  <button className="bg-red-600 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all">
                    Planifier
                  </button>
                </div>

                <div className="bg-white border border-zinc-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50/50">
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Vaccin</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Doses</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date AdministrÉe</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Prochaine Dose</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {vaccinations.map((v, i) => (
                        <tr key={i} className="hover:bg-zinc-50/30 transition-colors">
                          <td className="px-8 py-5 font-bold text-sm text-zinc-900">{v.label}</td>
                          <td className="px-8 py-5 font-mono text-xs text-zinc-500">{v.dose}</td>
                          <td className="px-8 py-5 font-mono text-xs text-zinc-900">{v.date}</td>
                          <td className="px-8 py-5 font-mono text-xs text-zinc-400">{v.next}</td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-2 py-1 text-[9px] font-black uppercase tracking-widest border flex items-center gap-2 w-fit",
                              v.color === 'green' ? "bg-green-50 text-green-700 border-green-100" :
                              v.color === 'red' ? "bg-red-50 text-red-700 border-red-100" :
                              "bg-amber-50 text-amber-700 border-amber-100"
                            )}>
                              {v.color === 'green' ? '✅' : v.color === 'red' ? '🔴' : '🟠'} {v.status}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right font-mono text-xs text-zinc-400">
                             {(v.color === 'red' || v.color === 'amber') && (
                               <button className="text-[#1A6FD4] font-black hover:underline uppercase tracking-widest text-[10px]">
                                 Enregistrer
                               </button>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'croissance' ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-900">Courbe_De_Croissance_OMS — Amadou Bah</h2>
                  <div className="h-px bg-zinc-200 flex-1 mx-8"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Weight for Age */}
                  <div className="bg-white border border-zinc-200 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                         <Scale className="w-3 h-3" /> Poids_Pour_Âge (0–5 ans)
                       </h3>
                       <span className="text-[10px] font-mono font-black text-amber-600 bg-amber-50 px-2 py-0.5 border border-amber-100">Patient à P15</span>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={growthData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="age" 
                            stroke="#D4D4D8" 
                            fontSize={10} 
                            tickFormatter={(val) => `${val}a`}
                            label={{ value: 'Âge (années)', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#A1A1AA' }}
                          />
                          <YAxis 
                            stroke="#D4D4D8" 
                            fontSize={10} 
                            label={{ value: 'Poids (kg)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#A1A1AA' }} 
                          />
                          <Tooltip 
                            contentStyle={{ fontSize: '10px', border: '1px solid #E4E4E7', borderRadius: '0', fontWeight: 'bold' }}
                            itemStyle={{ textTransform: 'uppercase' }}
                          />
                          {/* Percentiles */}
                          <Line type="monotone" dataKey="p97" stroke="#E4E4E7" strokeWidth={1} dot={false} strokeDasharray="5 5" name="P97" />
                          <Line type="monotone" dataKey="p85" stroke="#E4E4E7" strokeWidth={1} dot={false} strokeDasharray="5 5" name="P85" />
                          <Line type="monotone" dataKey="p50" stroke="#71717A" strokeWidth={1} dot={false} name="P50 (Médiane)" />
                          <Line type="monotone" dataKey="p15" stroke="#F59E0B" strokeWidth={1.5} dot={false} name="P15" />
                          <Line type="monotone" dataKey="p3" stroke="#EF4444" strokeWidth={1} dot={false} strokeDasharray="5 5" name="P3" />
                          
                          {/* Patient Curve */}
                          <Line type="monotone" dataKey="patient" stroke="#1A6FD4" strokeWidth={3} dot={{ r: 4, fill: '#1A6FD4', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Patient" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Height for Age */}
                  <div className="bg-white border border-zinc-200 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                         <Ruler className="w-3 h-3" /> Taille_Pour_Âge (0–5 ans)
                       </h3>
                       <span className="text-[10px] font-mono font-black text-zinc-900 bg-zinc-50 px-2 py-0.5 border border-zinc-200">Patient à P20</span>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={heightData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="age" stroke="#D4D4D8" fontSize={10} tickFormatter={(val) => `${val}a`} />
                          <YAxis stroke="#D4D4D8" fontSize={10} domain={[40, 130]} />
                          <Tooltip 
                            contentStyle={{ fontSize: '10px', border: '1px solid #E4E4E7', borderRadius: '0', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" dataKey="p97" stroke="#E4E4E7" strokeWidth={1} dot={false} strokeDasharray="5 5" name="P97" />
                          <Line type="monotone" dataKey="p50" stroke="#71717A" strokeWidth={1} dot={false} name="P50" />
                          <Line type="monotone" dataKey="p3" stroke="#EF4444" strokeWidth={1} dot={false} strokeDasharray="5 5" name="P3" />
                          <Line type="monotone" dataKey="patient" stroke="#1A6FD4" strokeWidth={3} dot={{ r: 4, fill: '#1A6FD4', strokeWidth: 0 }} name="Patient" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Malnutrition Alert */}
                <div className="bg-amber-50 border border-amber-100 p-8 flex items-center gap-6">
                  <div className="w-16 h-16 bg-white border border-amber-200 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-amber-900 mb-1">Alerte_Nutritionnelle</h4>
                    <p className="text-xs font-bold text-amber-800 tracking-tight">
                      ⚠️ Poids au P15 — Surveillance nutritionnelle recommandée <br/>
                      <span className="text-[10px] font-mono uppercase tracking-widest mt-2 block opacity-70">Poids attendu pour P50 : 16.8 kg | Déficit : 3.6 kg</span>
                    </p>
                  </div>
                </div>

                {/* measurement history */}
                <div className="space-y-6">
                   <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900">Historique_Des_Mesures</h3>
                   <div className="bg-white border border-zinc-200 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-zinc-50/50 border-b border-zinc-100">
                          <tr>
                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Poids</th>
                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Taille</th>
                            <th className="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Saisi_Par</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {measurementHistory.map((m, i) => (
                            <tr key={i}>
                              <td className="px-8 py-4 font-mono text-xs">{m.date}</td>
                              <td className="px-8 py-4 font-bold text-sm text-zinc-900">{m.weight}</td>
                              <td className="px-8 py-4 font-bold text-sm text-zinc-900">{m.height}</td>
                              <td className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{m.author}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </div>
              </div>
            ) : (
              <div className="py-40 text-center bg-zinc-50 border border-dashed border-zinc-200">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 bg-white border border-zinc-200 flex items-center justify-center mx-auto opacity-40">
                     <History className="w-6 h-6 text-zinc-400" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Données non disponibles</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] leading-relaxed">
                    Cette section ne contient pas encore d'enregistrements pour ce patient. <br/>
                    Veuillez synchroniser les dossiers ou ajouter manuellement.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRINT PREVIEW PANEL */}
      <AnimatePresence>
        {isPrinting && (
          <div className="fixed inset-0 z-[200] flex">
             {/* Dimmed backdrop */}
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsPrinting(false)}
               className="flex-1 bg-black/10 backdrop-blur-[2px]"
             />
             
             {/* Slide-in Sidebar Panel */}
             <motion.div 
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="w-[40%] bg-zinc-100 border-l border-zinc-200 shadow-2xl flex flex-col"
             >
                <div className="p-8 bg-white border-b border-zinc-200 flex items-center justify-between">
                   <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900">Aperçu_Avant_Impression</h3>
                   <button onClick={() => setIsPrinting(false)} className="text-zinc-400 hover:text-zinc-900 text-2xl font-light">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-12 flex justify-center">
                   {/* A5 Simulation */}
                   <div className="w-full max-w-[420px] aspect-[1/1.414] bg-white shadow-lg p-10 font-serif text-zinc-900 flex flex-col relative">
                      <div className="text-center border-b-2 border-zinc-900 pb-6 mb-8">
                         <h4 className="text-sm font-bold uppercase tracking-widest mb-1">HÔPITAL DE DISTRICT</h4>
                         <p className="text-[10px] font-sans uppercase tracking-[0.2em] opacity-60 mb-4">Service Pédiatrie</p>
                         
                         <div className="mt-4">
                            <p className="text-sm font-bold">Dr. Moussa Diallo</p>
                            <p className="text-[10px] font-sans">Médecin pédiatre</p>
                            <p className="text-[10px] font-sans opacity-60">N° Ordre: MED-2024-0089</p>
                         </div>
                      </div>

                      <div className="flex justify-between items-baseline mb-8">
                         <h5 className="text-lg font-bold tracking-tighter">ORDONNANCE</h5>
                         <span className="text-[10px] font-sans opacity-60">Fait le: 18/04/2025</span>
                      </div>

                      <div className="mb-10 text-[11px] space-y-1">
                         <p className="font-sans font-bold">Patient: <span className="uppercase text-zinc-900">Amadou Bah</span></p>
                         <p className="font-sans opacity-60 italic">Âge: 4 ans 7 mois | Poids: 13.2kg</p>
                      </div>

                      <div className="flex-1 space-y-6">
                         <div className="space-y-1">
                            <p className="text-sm font-bold">1. Artéméther-Luméfantrine</p>
                            <p className="text-[10px] opacity-70 ml-4 font-sans italic">1 cp × 2/j pendant 3 jours (matin et soir au repas)</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-sm font-bold">2. Paracétamol 200mg</p>
                            <p className="text-[10px] opacity-70 ml-4 font-sans italic">1 cp × 3/j si fièvre &gt; 38.5°C</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-sm font-bold">3. SRO (Réhydratation)</p>
                            <p className="text-[10px] opacity-70 ml-4 font-sans italic">Réhydratation orale ad libitum</p>
                         </div>
                      </div>

                      <div className="mt-10 pt-6 border-t border-dotted border-zinc-200">
                         <div className="mb-8 flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider font-sans">⚠ Allergie connue: Pénicilline</span>
                         </div>
                         
                         <p className="text-[10px] font-sans mb-8">Prochain RDV : <span className="font-bold underline">25/04/2025</span></p>
                         
                         <div className="flex justify-between items-end">
                            <div className="w-20 h-20 border border-zinc-100 flex items-center justify-center font-mono text-[8px] text-zinc-200 uppercase rotate-[-15deg]">
                               Cachet Hôpital
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-sans opacity-40 mb-10">Signature :</p>
                               <div className="w-32 h-px bg-zinc-900 opacity-20"></div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="p-8 bg-white border-t border-zinc-200 flex gap-4">
                   <button className="flex-1 bg-[#1A6FD4] text-white px-6 py-4 text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-lg">
                      <Printer className="w-4 h-4" /> Imprimer maintenant
                   </button>
                   <button 
                     onClick={() => setIsPrinting(false)}
                     className="flex-1 bg-white border-2 border-zinc-900 text-zinc-900 px-6 py-4 text-[11px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all"
                   >
                      Fermer
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      </main>

      {/* FOOTER CONTEXT */}
      <footer className="fixed bottom-0 left-0 w-full h-12 bg-white border-t border-zinc-200 px-10 flex items-center justify-between z-50">
        <div className="flex items-center gap-8 text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
          <span className="flex items-center gap-2 text-zinc-900 font-black"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> System_Active</span>
          <span>Node: Ped_District_HQ</span>
          <span>Session: 03h 42m</span>
        </div>
        <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
           PÉdiatrix v2.4.0 — 2026
        </div>
      </footer>
    </div>
  );
}
