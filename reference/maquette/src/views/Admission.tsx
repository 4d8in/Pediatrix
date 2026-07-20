import React from 'react';
import { 
  Baby, 
  Users, 
  BadgeInfo, 
  Building2, 
  Calendar, 
  ChevronRight, 
  MapPin, 
  Phone, 
  Mail, 
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Printer
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Admission({ onCancel }: { onCancel: () => void }) {
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  if (isSubmitted) {
    return (
      <div className="p-10 max-w-2xl mx-auto space-y-10 animate-in fade-in zoom-in-95">
        <div className="bg-white border border-zinc-200 shadow-xl overflow-hidden">
           <div className="bg-green-500 p-8 flex flex-col items-center text-white space-y-4">
              <CheckCircle2 className="w-16 h-16" />
              <div className="text-center">
                 <h2 className="text-xl font-black uppercase tracking-[0.2em]">Dossier_Créé_Avec_Succès</h2>
                 <p className="text-xs font-mono font-bold opacity-80 uppercase tracking-widest">Référence unique: PED-2024-00412</p>
              </div>
           </div>
           
           <div className="p-10 space-y-10">
              <div className="flex flex-col items-center space-y-6">
                 <div className="w-32 h-32 bg-zinc-50 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center relative group">
                    <QrCode className="w-16 h-16 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                    <div className="absolute inset-x-0 bottom-2 text-center">
                       <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">QR Code Patient</span>
                    </div>
                 </div>
                 
                 <div className="text-center space-y-2">
                    <p className="text-sm font-black text-zinc-900">AMINA OPT OSEI</p>
                    <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Née le 12/04/2021 — Fém.</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <button className="bg-zinc-900 text-white px-6 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center justify-center gap-3 shadow-lg">
                    <Printer className="w-4 h-4" /> Imprimer le QR code
                 </button>
                 <button className="bg-white border-2 border-zinc-900 text-zinc-900 px-6 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center justify-center gap-3">
                    <BadgeInfo className="w-4 h-4" /> Imprimer le bracelet
                 </button>
              </div>

              <div className="pt-6 border-t border-zinc-100">
                <button 
                  onClick={onCancel}
                  className="w-full text-[10px] font-black uppercase tracking-widest text-[#1A6FD4] hover:underline"
                >
                  Retour au tableau de bord →
                </button>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-5xl mx-auto space-y-10 relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-200 pb-10">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-[0.2em] mb-3">Admission_Nouveau_Patient</h1>
          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Protocole_Enregistrement_v4.2 // Procédure_Standard</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 px-4 py-2 text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
           Sess_Auto_Save: 15:39:42
        </div>
      </div>

      <form 
        className="space-y-10 pb-20"
        onSubmit={(e) => {
          e.preventDefault();
          setIsSubmitted(true);
        }}
      >
        {/* Section 1: Patient Information */}
        <section className="bg-white rounded-none border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100 flex items-center justify-between">
             <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">01_IDENTITE_PATIENT</h2>
             <div className="w-4 h-4 bg-zinc-900"></div>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Prénom_Patient</label>
                <input type="text" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs uppercase" placeholder="AMINA" />
             </div>
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Deuxième_Nom</label>
                <input type="text" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs uppercase" placeholder="OPT" />
             </div>
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom_Famille</label>
                <input type="text" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs uppercase" placeholder="OSEI" />
             </div>
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date_Naissance</label>
                <div className="relative">
                   <input type="date" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all font-mono text-[10px]" />
                </div>
             </div>
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sexe_Patient</label>
                <select className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all appearance-none cursor-pointer text-[10px] font-mono tracking-widest">
                   <option>CHOISIR</option>
                   <option>FEMININ</option>
                   <option>MASCULIN</option>
                </select>
             </div>
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Groupe_Sanguin</label>
                <select className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all appearance-none cursor-pointer text-[10px] font-mono tracking-widest">
                   <option>INCONNU</option>
                   <option>O+</option>
                   <option>A+</option>
                </select>
             </div>
          </div>
        </section>

        {/* Section 2: Parent/Guardian */}
        <section className="bg-white rounded-none border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-zinc-50/50 px-8 py-4 border-b border-zinc-100 flex items-center justify-between">
             <h2 className="text-[10px] font-bold uppercase tracking-[0.3em]">02_CONTACT_TUTEUR</h2>
             <div className="w-4 h-4 border border-zinc-900"></div>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom_Complet_Tuteur</label>
                <input type="text" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs uppercase" />
             </div>
             <div className="grid grid-cols-2 gap-10">
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Relation</label>
                   <select className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all appearance-none cursor-pointer text-[10px] font-mono tracking-widest">
                      <option>FILIATION</option>
                      <option>MERE</option>
                      <option>PERE</option>
                   </select>
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Contact_Mob</label>
                   <input type="tel" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all font-mono text-[10px] tracking-widest" placeholder="+254_XXXXX" />
                </div>
             </div>
             <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Adresse_Résidence</label>
                <input type="text" className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-none focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs uppercase" />
             </div>
          </div>
        </section>

        {/* Action Footer */}
        <div className="flex flex-col sm:flex-row justify-end gap-6 pt-10">
           <button 
             type="button" 
             onClick={onCancel}
             className="px-10 py-3 bg-white border border-zinc-200 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-all font-black"
           >
             ANNULER
           </button>
           <button 
             type="submit" 
             className="px-10 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all font-black shadow-lg"
           >
             VALIDER_ADMISSION
           </button>
        </div>
      </form>
    </div>
  );
}

function PlusCircle({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}
