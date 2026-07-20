import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  ChevronRight, 
  ArrowRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LabRequest {
  id: string;
  patientName: string;
  patientId: string;
  age: string;
  bed: string;
  exams: string;
  doctor: string;
  timeAgo: string;
  priority: 'critique' | 'urgent' | 'normal';
}

export default function Laboratory() {
  const [selectedRequest, setSelectedRequest] = useState<LabRequest | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [results, setResults] = useState({
    hb: '',
    leuco: '',
    plaq: '',
    ge: 'Négative'
  });

  const pendingRequests: LabRequest[] = [
    { 
      id: 'LAB-0047', 
      patientName: 'Amadou Bah', 
      patientId: 'PED-2024-00412',
      age: '4 ans 7 mois',
      bed: 'Lit P-07',
      exams: 'NFS + Goutte épaisse', 
      doctor: 'Dr. Moussa Diallo', 
      timeAgo: '45 min', 
      priority: 'critique' 
    },
    { 
      id: 'LAB-0048', 
      patientName: 'Fatimata Sy', 
      patientId: 'PED-2024-00501',
      age: '2 ans 3 mois',
      bed: 'Lit P-02',
      exams: 'CRP + Glycémie', 
      doctor: 'Dr. A. Camara', 
      timeAgo: '2h', 
      priority: 'urgent' 
    },
    { 
      id: 'LAB-0049', 
      patientName: 'Ibrahima Diop', 
      patientId: 'PED-2024-00388',
      age: '7 ans',
      bed: 'Lit P-12',
      exams: 'ECBU', 
      doctor: 'Dr. Moussa Diallo', 
      timeAgo: '3h', 
      priority: 'normal' 
    },
  ];

  useEffect(() => {
    // Select the first one by default if none selected
    if (!selectedRequest && pendingRequests.length > 0) {
      setSelectedRequest(pendingRequests[0]);
    }
  }, [selectedRequest]);

  const handleInputChange = (field: string, value: string) => {
    setResults(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    // In a real app, this would deduct from the badge count in App.tsx
  };

  const hbValue = parseFloat(results.hb);
  const isHbCritical = !isNaN(hbValue) && hbValue < 7;

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden bg-zinc-50 font-sans">
      {/* LEFT PANEL - Requests Queue */}
      <div className="w-[40%] border-r border-zinc-200 bg-white flex flex-col">
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900 flex items-center gap-3">
            <FlaskConical className="w-4 h-4" /> Demandes_en_Attente (3)
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {pendingRequests.map((req) => (
            <button
              key={req.id}
              onClick={() => {
                setSelectedRequest(req);
                setIsSubmitted(false);
                setResults({ hb: '', leuco: '', plaq: '', ge: 'Négative' });
              }}
              className={cn(
                "w-full p-6 text-left border-b border-zinc-50 transition-all group relative",
                selectedRequest?.id === req.id ? "bg-zinc-100/50" : "hover:bg-zinc-50"
              )}
            >
              {selectedRequest?.id === req.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900"></div>
              )}
              
              <div className="flex justify-between items-start mb-3">
                <span className={cn(
                  "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border",
                  req.priority === 'critique' ? "bg-red-100 text-red-700 border-red-200" :
                  req.priority === 'urgent' ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-zinc-100 text-zinc-500 border-zinc-200"
                )}>
                  {req.priority}
                </span>
                <span className="text-[9px] font-mono text-zinc-400">il y a {req.timeAgo}</span>
              </div>
              
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 group-hover:text-[#1A6FD4] transition-colors">
                  {req.patientName} — <span className="font-mono text-xs">{req.exams}</span>
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  <User className="w-3 h-3" /> {req.doctor}
                </div>
              </div>

              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL - Entry Form */}
      <div className="w-[60%] flex flex-col bg-white overflow-y-auto">
        {selectedRequest ? (
          <>
            <div className="p-8 border-b border-zinc-100">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-900 mb-6">
                Saisie_RÉsultats — {selectedRequest.patientName} — {selectedRequest.id}
              </h2>
              
              {/* Patient Info Bar */}
              <div className="flex items-center gap-8 bg-zinc-50 p-4 border border-zinc-200">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">ID_Patient</span>
                  <span className="text-xs font-mono font-bold text-zinc-900">{selectedRequest.patientId}</span>
                </div>
                <div className="w-px h-8 bg-zinc-200"></div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Âge</span>
                  <span className="text-xs font-bold text-zinc-900">{selectedRequest.age}</span>
                </div>
                <div className="w-px h-8 bg-zinc-200"></div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Localisation</span>
                  <span className="text-xs font-bold text-zinc-900">{selectedRequest.bed}</span>
                </div>
              </div>
            </div>

            <div className="p-8 flex-1">
              {isSubmitted ? (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-zinc-900 mb-2">RÉsultats_EnvoyÉs</h3>
                  <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
                    {selectedRequest.doctor} notifié — 14h47
                  </p>
                  <button 
                    onClick={() => {
                      setIsSubmitted(false);
                      setResults({ hb: '', leuco: '', plaq: '', ge: 'Négative' });
                      // In real app, remove the request from queue
                    }}
                    className="mt-10 px-8 py-3 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all"
                  >
                    Demande Suivante <ArrowRight className="w-4 h-4 inline ml-2" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-10">
                  {/* Results Table */}
                  <div className="border border-zinc-200 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50/50 border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">ParamÈtre</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Valeur_Entrée</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400">Norme (Pédiatrique)</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        <tr>
                          <td className="px-6 py-5 text-xs font-bold text-zinc-900">Hémoglobine</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                value={results.hb}
                                onChange={(e) => handleInputChange('hb', e.target.value)}
                                className={cn(
                                  "w-24 bg-white border border-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1A6FD4]",
                                  isHbCritical && "text-red-600 border-red-300 bg-red-50/30"
                                )}
                                placeholder="0.0"
                              />
                              <span className="text-[10px] font-mono text-zinc-400">g/dL</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-[10px] font-mono text-zinc-400 italic">10.5 – 14.5</td>
                          <td className="px-6 py-5 text-right">
                            {isHbCritical && <TrendingDown className="w-4 h-4 text-red-500 ml-auto" />}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-5 text-xs font-bold text-zinc-900">Leucocytes</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                value={results.leuco}
                                onChange={(e) => handleInputChange('leuco', e.target.value)}
                                className="w-24 bg-white border border-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1A6FD4]"
                                placeholder="0"
                              />
                              <span className="text-[10px] font-mono text-zinc-400">/μL</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-[10px] font-mono text-zinc-400 italic">5000 – 15000</td>
                          <td className="px-6 py-5 text-right"></td>
                        </tr>
                        <tr>
                          <td className="px-6 py-5 text-xs font-bold text-zinc-900">Plaquettes</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                value={results.plaq}
                                onChange={(e) => handleInputChange('plaq', e.target.value)}
                                className="w-24 bg-white border border-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1A6FD4]"
                                placeholder="0"
                              />
                              <span className="text-[10px] font-mono text-zinc-400">/μL</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-[10px] font-mono text-zinc-400 italic">150k – 400k</td>
                          <td className="px-6 py-5 text-right"></td>
                        </tr>
                        <tr>
                          <td className="px-6 py-5 text-xs font-bold text-zinc-900">Goutte épaisse</td>
                          <td className="px-6 py-5">
                            <select 
                              value={results.ge}
                              onChange={(e) => handleInputChange('ge', e.target.value)}
                              className="w-full bg-white border border-zinc-200 px-3 py-2 text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-[#1A6FD4]"
                            >
                              <option value="Négative">Négative</option>
                              <option value="Positive">Positive (+)</option>
                              <option value="Positive ++">Positive (++)</option>
                              <option value="Positive +++">Positive (+++)</option>
                            </select>
                          </td>
                          <td className="px-6 py-5 text-[10px] font-mono text-zinc-400 italic">Négative</td>
                          <td className="px-6 py-5 text-right">
                            {results.ge.includes('Positive') && <div className="w-2.5 h-2.5 bg-red-500 rounded-full ml-auto"></div>}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Critical Warning */}
                  <AnimatePresence>
                    {isHbCritical && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-red-50 border border-red-100 p-6 flex gap-4 animate-pulse"
                      >
                        <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                        <div>
                          <h4 className="text-[11px] font-black uppercase text-red-700 tracking-wider mb-1">Valeur_critique_DÉtectée</h4>
                          <p className="text-xs font-medium text-red-600 uppercase">
                            Hémoglobine {results.hb} g/dL — Le médecin sera notifié automatiquement lors de la validation.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pt-6 flex justify-end gap-6 items-center">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Info className="w-4 h-4" />
                      <span className="text-[10px] font-mono uppercase italic">Double-vérification requise pour valeurs critiques</span>
                    </div>
                    <button 
                      type="submit"
                      className="bg-[#1A6FD4] text-white px-10 py-4 text-xs font-black uppercase tracking-widest hover:bg-[#1559ab] transition-all shadow-xl shadow-blue-500/10 flex items-center gap-3"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Valider et envoyer au {selectedRequest.doctor}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30">
            <FlaskConical className="w-16 h-16 mb-6" />
            <p className="text-[11px] font-black uppercase tracking-[0.3em]">SÉlectionner_Une_Demande</p>
          </div>
        )}
      </div>
    </div>
  );
}
