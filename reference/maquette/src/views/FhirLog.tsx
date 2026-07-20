import React, { useState } from 'react';
import { 
  BarChartHorizontal, 
  ChevronRight, 
  RefreshCcw, 
  Terminal,
  Database,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';

type FhirResource = 'Patient' | 'Encounter' | 'Observation' | 'MedicationRequest' | 'ServiceRequest' | 'DiagnosticReport';

interface LogEntry {
  id: string;
  timestamp: string;
  type: FhirResource;
  description: string;
  data: any;
}

const LOGS_MOCK: LogEntry[] = [
  { 
    id: '1', 
    timestamp: '14h47', 
    type: 'DiagnosticReport', 
    description: 'Résultats NFS — Amadou Bah',
    data: {
      "resourceType": "DiagnosticReport",
      "id": "lab-report-0047",
      "status": "final",
      "subject": {
        "reference": "Patient/PED-2024-00412",
        "display": "Amadou Bah"
      },
      "issued": "2025-04-18T14:47:00+00:00",
      "result": [
        { "display": "Hémoglobine: 8.2 g/dL (bas)" },
        { "display": "Plaquettes: 98000 /μL (bas)" },
        { "display": "Goutte épaisse: Positive P.falciparum" }
      ],
      "performer": {
        "display": "Technicien Labo — Hôpital de District"
      }
    }
  },
  { 
    id: '2', 
    timestamp: '14h32', 
    type: 'ServiceRequest', 
    description: 'Demande NFS — Dr. Diallo → Labo',
    data: {
      "resourceType": "ServiceRequest",
      "id": "req-nfs-01",
      "status": "active",
      "intent": "order",
      "code": { "coding": [{ "display": "Numération Formule Sanguine" }] },
      "subject": { "reference": "Patient/PED-2024-00412" },
      "requester": { "display": "Dr. Moussa Diallo" }
    }
  },
  { 
    id: '3', 
    timestamp: '14h23', 
    type: 'MedicationRequest', 
    description: 'Artéméther prescrit — Amadou Bah',
    data: {
      "resourceType": "MedicationRequest",
      "id": "med-001",
      "status": "active",
      "subject": { "reference": "Patient/PED-2024-00412" },
      "medicationCodeableConcept": { "text": "Artéméther-Luméfantrine" },
      "dosageInstruction": [{ "text": "1 cp x 2/j pendant 3 jours" }]
    }
  },
  { 
    id: '4', 
    timestamp: '14h15', 
    type: 'Observation', 
    description: 'SpO2 97% — saisi par Inf. Sow',
    data: {
      "resourceType": "Observation",
      "id": "obs-spo2-01",
      "status": "final",
      "subject": { "reference": "Patient/PED-2024-00412" },
      "code": { "text": "SpO2" },
      "valueQuantity": { "value": 97, "unit": "%" }
    }
  },
  { 
    id: '5', 
    timestamp: '14h10', 
    type: 'Encounter', 
    description: 'Consultation ouverte — Amadou Bah',
    data: {
      "resourceType": "Encounter",
      "id": "enc-001",
      "status": "in-progress",
      "class": { "display": "ambulatory" },
      "subject": { "reference": "Patient/PED-2024-00412" }
    }
  },
  { 
    id: '6', 
    timestamp: '08h15', 
    type: 'Patient', 
    description: 'Dossier créé — PED-2024-00412',
    data: {
      "resourceType": "Patient",
      "id": "PED-2024-00412",
      "name": [{ "family": "Bah", "given": ["Amadou"] }],
      "gender": "male",
      "birthDate": "2020-09-12"
    }
  }
];

const badgeColors: Record<FhirResource, string> = {
  Patient: 'bg-blue-100 text-blue-700 border-blue-200',
  Encounter: 'bg-purple-100 text-purple-700 border-purple-200',
  Observation: 'bg-teal-100 text-teal-700 border-teal-200',
  MedicationRequest: 'bg-amber-100 text-amber-700 border-amber-200',
  ServiceRequest: 'bg-orange-100 text-orange-700 border-orange-200',
  DiagnosticReport: 'bg-green-100 text-green-700 border-green-200'
};

const flowChain: FhirResource[] = ['Patient', 'Encounter', 'ServiceRequest', 'DiagnosticReport'];

export default function FhirLog() {
  const [selectedEntry, setSelectedEntry] = useState<LogEntry>(LOGS_MOCK[0]);

  return (
    <div className="h-full flex flex-col bg-zinc-900 border-l border-white/5 relative">
      <div className="p-8 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl flex items-center justify-between shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-green-500" />
            <h1 className="text-sm font-black uppercase tracking-[0.3em] text-white">Console_Flux_FHIR</h1>
          </div>
          <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
            Écran technique — non visible par le personnel clinique • FHIR R4 → PostgreSQL
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
          <RefreshCcw className="w-3 h-3" /> Actualiser
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: RESOURCE STREAM */}
        <div className="w-[35%] border-r border-white/5 flex flex-col bg-zinc-900/30">
          <div className="p-6 border-b border-white/5">
             <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Flux_FHIR_En_Direct</h2>
             <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mt-1">Ressources générées par le système</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
             {LOGS_MOCK.map((log) => (
               <button 
                 key={log.id}
                 onClick={() => setSelectedEntry(log)}
                 className={cn(
                   "w-full p-6 flex flex-col gap-3 group border-b border-white/[0.02] text-left transition-all",
                   selectedEntry.id === log.id ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                 )}
               >
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-zinc-500">{log.timestamp}</span>
                    <div className="flex gap-2">
                       <span className="text-[7px] font-black px-1.5 py-0.5 border border-green-500/30 text-green-500 uppercase tracking-widest bg-green-500/10">VALID_FHIR_R4</span>
                       <span className={cn(
                         "text-[8px] font-black px-2 py-0.5 border uppercase tracking-widest rounded-sm",
                         badgeColors[log.type]
                       )}>
                         {log.type}
                       </span>
                    </div>
                 </div>
                 <p className={cn(
                   "text-xs font-bold transition-colors",
                   selectedEntry.id === log.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                 )}>
                   {log.description}
                 </p>
               </button>
             ))}
          </div>
        </div>

        {/* RIGHT PANEL: RESOURCE DETAIL */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
           <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Resource_JSON_Viewer</span>
                 <span className="text-zinc-700 text-xs">/</span>
                 <span className="text-[10px] font-mono text-green-500">{selectedEntry.type}/{selectedEntry.id}</span>
              </div>
              <div className="flex gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20"></div>
                 <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-10">
              <div className="bg-zinc-900/50 border border-white/5 p-8 font-mono text-xs leading-relaxed text-zinc-300 overflow-x-auto shadow-2xl">
                 <pre>{JSON.stringify(selectedEntry.data, null, 2)}</pre>
              </div>

              {/* FLOW DIAGRAM */}
              <div className="mt-auto pt-10 border-t border-white/5">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-8">Data_Persistence_Flow</h3>
                 <div className="flex items-center gap-4">
                    {flowChain.map((step, idx) => (
                      <React.Fragment key={step}>
                        <div className={cn(
                          "px-4 py-2 border text-[10px] font-black uppercase tracking-widest transition-all",
                          selectedEntry.type === step 
                            ? "bg-green-500 text-white border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                            : "bg-white/5 border-white/10 text-zinc-500"
                        )}>
                          {step}
                        </div>
                        {idx < flowChain.length - 1 && <ArrowRight className="w-3 h-3 text-zinc-700" />}
                      </React.Fragment>
                    ))}
                    <ArrowRight className="w-3 h-3 text-zinc-700" />
                    <div className="flex items-center gap-2 text-zinc-500">
                       <Database className="w-4 h-4" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em]">PostgreSQL</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
      
      {/* GLOW DECORATIONS */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500/5 blur-[100px] pointer-events-none"></div>
    </div>
  );
}
