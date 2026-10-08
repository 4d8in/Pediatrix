import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  CircleUserRound,
  FileText,
  FlaskConical,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MonitorCheck,
  Settings as SettingsIcon,
  Search,
  ScanLine,
  Stethoscope,
  Syringe,
  Terminal,
  BarChart3,
  UserPlus,
  UsersRound,
} from "lucide-react";
import Dashboard from "./views/Dashboard";
import Admission from "./views/Admission";
import Consultations from "./views/Consultations";
import PatientRecord from "./views/PatientRecord/PatientRecord";
import Laboratory from "./views/Laboratory";
import Radiology from "./views/Radiology";
import FhirLog from "./views/FhirLog";
import Login from "./views/Login";
import Vaccinations from "./views/Vaccinations";
import Stats from "./views/Stats";
import ActiveQueue from "./views/ActiveQueue";
import Settings from "./views/Settings";
import Supervision from "./views/Supervision";
import Beds from "./views/Beds";
import NurseDashboard from "./views/NurseDashboard";
import Accounts from "./views/Accounts";
import Profile, { photoSrc } from "./views/Profile";
import { getMyProfile } from "./lib/api";
import UpdateBanner from "./components/UpdateBanner";
import ConnectionBanner from "./components/ConnectionBanner";
import { LogoBadge } from "./components/Logo";
import { useAuth } from "./lib/auth-context";
import type { Role, UserProfile } from "./lib/types";
import "./App.css";

type ViewType =
  | "dashboard"
  | "admission"
  | "consultations"
  | "record"
  | "laboratory"
  | "radiology"
  | "fhirLog"
  | "vaccinations"
  | "stats"
  | "queue"
  | "settings"
  | "supervision"
  | "beds"
  | "accounts"
  | "profile";

// Masquage ergonomique uniquement : la barrière réelle est côté backend
// (preHandler authenticate/authorize sur chaque route, voir apps/backend).
const NAV_ITEMS: { id: ViewType; label: string; icon: typeof UserPlus; roles: Role[] }[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ["nurse", "doctor", "director"] },
  { id: "queue", label: "File active", icon: ListOrdered, roles: ["nurse", "doctor", "director"] },
  { id: "admission", label: "Admission", icon: UserPlus, roles: ["nurse", "doctor"] },
  { id: "consultations", label: "Consultations", icon: Stethoscope, roles: ["doctor"] },
  { id: "laboratory", label: "Laboratoire", icon: FlaskConical, roles: ["lab_tech"] },
  { id: "radiology", label: "Radiologie", icon: ScanLine, roles: ["radiologist"] },
  {
    id: "record",
    label: "Dossier patient",
    icon: FileText,
    roles: ["nurse", "doctor", "lab_tech", "radiologist", "director"],
  },
  { id: "supervision", label: "Supervision", icon: MonitorCheck, roles: ["tech_admin"] },
  { id: "accounts", label: "Comptes", icon: UsersRound, roles: ["tech_admin"] },
  { id: "fhirLog", label: "Flux FHIR", icon: Terminal, roles: ["tech_admin"] },
  { id: "beds", label: "Gestion des lits", icon: BedDouble, roles: ["nurse", "doctor", "director", "tech_admin"] },
  { id: "vaccinations", label: "Vaccinations", icon: Syringe, roles: ["nurse", "doctor"] },
  { id: "stats", label: "Statistiques", icon: BarChart3, roles: ["director"] },
  {
    id: "profile",
    label: "Mon profil",
    icon: CircleUserRound,
    roles: ["nurse", "doctor", "lab_tech", "radiologist", "director", "tech_admin"],
  },
  {
    id: "settings",
    label: "Paramètres",
    icon: SettingsIcon,
    roles: ["nurse", "doctor", "lab_tech", "radiologist", "director", "tech_admin"],
  },
];

function App() {
  const { user, logout, sessionExpired } = useAuth();
  const navItems = useMemo(() => NAV_ITEMS.filter((item) => user && item.roles.includes(user.role)), [user]);
  const [currentView, setCurrentView] = useState<ViewType | null>(null);
  const [recordPatientId, setRecordPatientId] = useState<string | null>(null);
  const [consultationPatientId, setConsultationPatientId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // Profil (nom affiché, photo) pour la barre du haut, rechargé à chaque connexion.
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    getMyProfile().then(setProfile).catch(() => undefined);
  }, [user]);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  if (!user) {
    return <Login notice={sessionExpired ? "Session expirée, veuillez vous reconnecter." : undefined} />;
  }

  const activeView = currentView && navItems.some((item) => item.id === currentView) ? currentView : navItems[0]?.id;

  function renderContent() {
    switch (activeView) {
      case "dashboard":
        if (user?.role === "nurse") {
          return (
            <NurseDashboard
              onOpenRecord={(patientId) => {
                setRecordPatientId(patientId);
                setCurrentView("record");
              }}
              onOpenBeds={() => setCurrentView("beds")}
              onOpenQueue={() => setCurrentView("queue")}
            />
          );
        }
        return (
          <Dashboard
            search={patientSearch}
            onOpenRecord={(patientId) => {
              setRecordPatientId(patientId);
              setCurrentView("record");
            }}
            onOpenConsultation={(patientId) => {
              setConsultationPatientId(patientId);
              setCurrentView("consultations");
            }}
          />
        );
      case "admission":
        return <Admission />;
      case "consultations":
        return <Consultations initialPatientId={consultationPatientId} />;
      case "record":
        return <PatientRecord initialPatientId={recordPatientId} />;
      case "laboratory":
        return <Laboratory />;
      case "radiology":
        return <Radiology />;
      case "fhirLog":
        return <FhirLog />;
      case "vaccinations":
        return <Vaccinations />;
      case "stats":
        return <Stats />;
      case "queue":
        return (
          <ActiveQueue
            onOpenRecord={(patientId) => {
              setRecordPatientId(patientId);
              setCurrentView("record");
            }}
            onOpenConsultation={
              user?.role === "doctor"
                ? (patientId) => {
                    setConsultationPatientId(patientId);
                    setCurrentView("consultations");
                  }
                : undefined
            }
          />
        );
      case "settings":
        return <Settings />;
      case "supervision":
        return <Supervision />;
      case "beds":
        return <Beds />;
      case "accounts":
        return <Accounts />;
      case "profile":
        return <Profile onSaved={setProfile} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex h-screen bg-[#F4F7FB] font-sans text-zinc-900">
      {/* Barre latérale : logo + navigation par rôle (maquette de référence). */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200/70 bg-white">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <LogoBadge className="h-9 w-9" />
          <span className="text-xl font-semibold text-[#0B2A4F]">Pédiatrix</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => setCurrentView(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                activeView === item.id
                  ? "bg-[#1A6FD4]/10 font-medium text-[#1A6FD4]"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-zinc-100 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Barre du haut : recherche patient + utilisateur connecté. */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-6 border-b border-zinc-200/70 bg-white px-6">
          {navItems.some((item) => item.id === "dashboard") ? (
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                placeholder="Rechercher un patient…"
                value={patientSearch}
                onChange={(event) => {
                  setPatientSearch(event.target.value);
                  setCurrentView("dashboard");
                }}
                className="w-full rounded-lg border border-zinc-200 bg-[#F4F7FB] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[#1A6FD4]"
              />
            </div>
          ) : (
            <div />
          )}
          <button
            onClick={() => setCurrentView("profile")}
            title="Mon profil"
            className="flex items-center gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-zinc-100"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#1A6FD4] text-sm font-semibold text-white">
              {profile?.photo ? (
                <img src={photoSrc(profile.photo)} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(profile?.displayName || user.name)
              )}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium">{profile?.displayName || user.name}</p>
              <p className="text-xs text-zinc-500">{ROLE_LABELS[user.role]}</p>
            </div>
          </button>
        </header>

        <ConnectionBanner onReconnect={reload} />
        <UpdateBanner />
        {/* La clé force le rechargement de l'écran courant après une reconnexion. */}
        <main key={reloadKey} className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<Role, string> = {
  nurse: "Infirmière",
  doctor: "Médecin",
  lab_tech: "Technicien labo",
  radiologist: "Radiologue",
  director: "Directeur",
  tech_admin: "Administrateur technique",
};

function initialsOf(name: string): string {
  const parts = name
    .replace(/^Dr\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default App;
