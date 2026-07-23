import { useMemo, useState } from "react";
import { FileText, FlaskConical, LogOut, ScanLine, Stethoscope, Terminal, UserPlus } from "lucide-react";
import Admission from "./views/Admission";
import Consultations from "./views/Consultations";
import PatientRecord from "./views/PatientRecord/PatientRecord";
import Laboratory from "./views/Laboratory";
import Radiology from "./views/Radiology";
import FhirLog from "./views/FhirLog";
import Login from "./views/Login";
import { useAuth } from "./lib/auth-context";
import type { Role } from "./lib/types";
import "./App.css";

type ViewType = "admission" | "consultations" | "record" | "laboratory" | "radiology" | "fhirLog";

// Masquage ergonomique uniquement : la barrière réelle est côté backend
// (preHandler authenticate/authorize sur chaque route, voir apps/backend).
const NAV_ITEMS: { id: ViewType; label: string; icon: typeof UserPlus; roles: Role[] }[] = [
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
];

function App() {
  const { user, logout, sessionExpired } = useAuth();
  const navItems = useMemo(() => NAV_ITEMS.filter((item) => user && item.roles.includes(user.role)), [user]);
  const [currentView, setCurrentView] = useState<ViewType | null>(null);

  if (!user) {
    return <Login notice={sessionExpired ? "Session expirée, veuillez vous reconnecter." : undefined} />;
  }

  const activeView = currentView && navItems.some((item) => item.id === currentView) ? currentView : navItems[0]?.id;

  function renderContent() {
    switch (activeView) {
      case "admission":
        return <Admission />;
      case "consultations":
        return <Consultations />;
      case "record":
        return <PatientRecord />;
      case "laboratory":
        return <Laboratory />;
      case "radiology":
        return <Radiology />;
      case "fhirLog":
        return <FhirLog />;
      default:
        return null;
    }
  }

  const activeLabel = navItems.find((item) => item.id === activeView)?.label;

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden">
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
