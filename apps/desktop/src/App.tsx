import { useMemo, useState } from "react";
import {
  Activity,
  Bed,
  Bell,
  FileText,
  FlaskConical,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  RefreshCcw,
  ScanLine,
  Settings as SettingsIcon,
  Stethoscope,
  Syringe,
  Terminal,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import Dashboard from "./views/Dashboard";
import Admission from "./views/Admission";
import Consultations from "./views/Consultations";
import PatientRecord from "./views/PatientRecord/PatientRecord";
import Laboratory from "./views/Laboratory";
import Radiology from "./views/Radiology";
import FhirLog from "./views/FhirLog";
import Login from "./views/Login";
import WardMap from "./views/WardMap";
import CoordinationPings from "./views/CoordinationPings";
import ConflictResolver from "./views/ConflictResolver";
import UsersView from "./views/Users";
import SettingsView from "./views/Settings";
import Support from "./views/Support";
import Vaccinations from "./views/Vaccinations";
import { useAuth } from "./lib/auth-context";
import type { Role } from "./lib/types";
import "./App.css";

type ViewType =
  | "dashboard"
  | "admission"
  | "consultations"
  | "record"
  | "laboratory"
  | "radiology"
  | "fhirLog"
  | "wardMap"
  | "coordinationPings"
  | "conflictResolver"
  | "users"
  | "settings"
  | "support"
  | "vaccinations";

// Masquage ergonomique uniquement : la barrière réelle est côté backend
// (preHandler authenticate/authorize sur chaque route, voir apps/backend).
const NAV_ITEMS: { id: ViewType; label: string; icon: typeof UserPlus; roles: Role[] }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ["nurse", "doctor", "director"] },
  { id: "admission", label: "Admission", icon: UserPlus, roles: ["nurse", "doctor"] },
  { id: "consultations", label: "Consultations", icon: Stethoscope, roles: ["doctor"] },
  {
    id: "record",
    label: "Dossier patient",
    icon: FileText,
    roles: ["nurse", "doctor", "lab_tech", "radiologist", "director"],
  },
  { id: "laboratory", label: "Laboratoire", icon: FlaskConical, roles: ["lab_tech"] },
  { id: "radiology", label: "Radiologie", icon: ScanLine, roles: ["radiologist"] },
  { id: "fhirLog", label: "Flux FHIR", icon: Terminal, roles: ["tech_admin"] },
  { id: "vaccinations", label: "Vaccinations", icon: Syringe, roles: ["nurse", "doctor"] },
  { id: "wardMap", label: "Carte des lits", icon: Bed, roles: ["nurse", "doctor"] },
  { id: "coordinationPings", label: "Coordination", icon: Bell, roles: ["nurse", "doctor", "director"] },
  { id: "conflictResolver", label: "Conflits sync.", icon: RefreshCcw, roles: ["tech_admin"] },
  { id: "users", label: "Utilisateurs", icon: UsersIcon, roles: ["tech_admin"] },
  { id: "settings", label: "Paramètres", icon: SettingsIcon, roles: ["tech_admin"] },
  {
    id: "support",
    label: "Support",
    icon: HelpCircle,
    roles: ["nurse", "doctor", "lab_tech", "radiologist", "director", "tech_admin"],
  },
];

interface EmergencyAlert {
  isActive: boolean;
  patientId: string | null;
  patientName: string | null;
  reportedBy: string | null;
  time: string | null;
  isResolved: boolean;
  resolvedTime: string | null;
}

const EMPTY_EMERGENCY_ALERT: EmergencyAlert = {
  isActive: false,
  patientId: null,
  patientName: null,
  reportedBy: null,
  time: null,
  isResolved: false,
  resolvedTime: null,
};

function App() {
  const { user, logout, sessionExpired } = useAuth();
  const navItems = useMemo(() => NAV_ITEMS.filter((item) => user && item.roles.includes(user.role)), [user]);
  const [currentView, setCurrentView] = useState<ViewType | null>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<EmergencyAlert>(EMPTY_EMERGENCY_ALERT);
  const [recordPatientId, setRecordPatientId] = useState<string | null>(null);
  const [consultationPatientId, setConsultationPatientId] = useState<string | null>(null);

  if (!user) {
    return <Login notice={sessionExpired ? "Session expirée, veuillez vous reconnecter." : undefined} />;
  }

  function triggerEmergency(patientId: string, patientName: string) {
    setEmergencyAlert({
      isActive: true,
      patientId,
      patientName,
      reportedBy: user!.name,
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      isResolved: false,
      resolvedTime: null,
    });
  }

  function dismissEmergency() {
    setEmergencyAlert((prev) => ({
      ...prev,
      isActive: false,
      isResolved: true,
      resolvedTime: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    }));
  }

  const activeView = currentView && navItems.some((item) => item.id === currentView) ? currentView : navItems[0]?.id;

  function renderContent() {
    switch (activeView) {
      case "dashboard":
        return (
          <Dashboard
            onOpenRecord={(patientId) => {
              setRecordPatientId(patientId);
              setCurrentView("record");
            }}
            onOpenConsultation={(patientId) => {
              setConsultationPatientId(patientId);
              setCurrentView("consultations");
            }}
            emergencyAlert={emergencyAlert}
          />
        );
      case "admission":
        return <Admission />;
      case "consultations":
        return <Consultations initialPatientId={consultationPatientId} />;
      case "record":
        return (
          <PatientRecord
            initialPatientId={recordPatientId}
            emergencyAlert={emergencyAlert}
            onTriggerEmergency={triggerEmergency}
          />
        );
      case "laboratory":
        return <Laboratory />;
      case "radiology":
        return <Radiology />;
      case "fhirLog":
        return <FhirLog />;
      case "vaccinations":
        return <Vaccinations />;
      case "wardMap":
        return <WardMap />;
      case "coordinationPings":
        return <CoordinationPings />;
      case "conflictResolver":
        return <ConflictResolver onClose={() => setCurrentView(navItems[0]?.id ?? null)} />;
      case "users":
        return <UsersView />;
      case "settings":
        return <SettingsView />;
      case "support":
        return <Support />;
      default:
        return null;
    }
  }

  const activeLabel = navItems.find((item) => item.id === activeView)?.label;

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden">
      {emergencyAlert.isActive && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white">
          <div className="px-10 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 bg-white/20 flex items-center justify-center animate-pulse">
                <Activity className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Urgence signalée</span>
                <p className="text-sm font-black uppercase tracking-tight">
                  {emergencyAlert.patientName} — Signalé par {emergencyAlert.reportedBy} — {emergencyAlert.time}
                </p>
              </div>
            </div>
            {(user.role === "doctor" || user.role === "director") && (
              <button
                onClick={dismissEmergency}
                className="bg-white text-red-600 px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
              >
                Désactiver l'alerte ×
              </button>
            )}
          </div>
        </div>
      )}
      <aside className="w-[280px] bg-[#1A2332] flex flex-col shrink-0 text-white">
        <div className="p-8 border-b border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A6FD4] flex items-center justify-center font-black text-xl">P</div>
          <h1 className="text-xl font-bold tracking-tight">Pédiatrix</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 transition-all ${
                activeView === item.id
                  ? "bg-[#1A6FD4] text-white shadow-lg shadow-blue-500/20"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-1">
          <div className="px-4 py-2">
            <p className="text-xs font-bold text-white truncate">{user.name}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-4 px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b border-zinc-200 px-10 flex items-center gap-4 bg-white shrink-0">
          <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-zinc-400 font-semibold">
            Pédiatrix
          </span>
          <span className="text-zinc-300 font-mono">/</span>
          <span className="text-xs font-black tracking-tight text-zinc-900 uppercase tracking-widest">
            {activeLabel}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto">{renderContent()}</div>
      </main>
    </div>
  );
}

export default App;
