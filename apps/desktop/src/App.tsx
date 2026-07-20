import { useState } from "react";
import { FileText, Stethoscope, UserPlus } from "lucide-react";
import Admission from "./views/Admission";
import Consultations from "./views/Consultations";
import PatientRecord from "./views/PatientRecord/PatientRecord";
import "./App.css";

type ViewType = "admission" | "consultations" | "record";

const NAV_ITEMS: { id: ViewType; label: string; icon: typeof UserPlus }[] = [
  { id: "admission", label: "Admission", icon: UserPlus },
  { id: "consultations", label: "Consultations", icon: Stethoscope },
  { id: "record", label: "Dossier patient", icon: FileText },
];

function App() {
  const [currentView, setCurrentView] = useState<ViewType>("admission");

  function renderContent() {
    switch (currentView) {
      case "admission":
        return <Admission />;
      case "consultations":
        return <Consultations />;
      case "record":
        return <PatientRecord />;
    }
  }

  const activeLabel = NAV_ITEMS.find((item) => item.id === currentView)?.label;

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden">
      <aside className="w-[280px] bg-[#1A2332] flex flex-col shrink-0 text-white">
        <div className="p-8 border-b border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A6FD4] flex items-center justify-center font-black text-xl">P</div>
          <h1 className="text-xl font-bold tracking-tight">Pédiatrix</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 transition-all ${
                currentView === item.id
                  ? "bg-[#1A6FD4] text-white shadow-lg shadow-blue-500/20"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
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
