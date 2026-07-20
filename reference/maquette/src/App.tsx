/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  Pill, 
  Beaker, 
  Syringe, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  HelpCircle,
  Search,
  Bell,
  RefreshCcw,
  CloudCheck,
  PlusCircle,
  Menu,
  LogOut,
  ChevronDown,
  FlaskConical,
  LayoutGrid,
  UserPlus,
  UserCircle,
  BarChartHorizontal,
  Activity,
  Lock,
  Bed
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Views
import Dashboard from './views/Dashboard';
import Laboratory from './views/Laboratory';
import Admission from './views/Admission';
import PatientRecord from './views/PatientRecord';
import Stats from './views/Stats';
import Login from './views/Login';
import FhirLog from './views/FhirLog';
import WardMap from './views/WardMap';
import CoordinationPings from './views/CoordinationPings';
import ConflictResolver from './views/ConflictResolver';
import Consultations from './views/Consultations';
import Prescriptions from './views/Prescriptions';
import Vaccinations from './views/Vaccinations';
import Growth from './views/Growth';
import UsersView from './views/Users';
import SettingsView from './views/Settings';
import Support from './views/Support';

type ViewType = 'dashboard' | 'patients' | 'consultations' | 'prescriptions' | 'lab' | 'vaccinations' | 'growth' | 'stats' | 'users' | 'settings' | 'support' | 'login' | 'admission' | 'record' | 'fhir' | 'ward' | 'pings';

const PATIENTS_MOCK = [
  { id: 'PC-2401-893', name: 'Amadou Bah', age: '4 Yrs', status: 'STABLE', type: 'DRAFT', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBdS61RZr3vamH7J23MgwUsMYW40ZmourbKEd5sH2ABp35k-jori1k9uIKY4VwC1Ax5az9aMjK5XWhf_umM1jghcKlUj_kRdXaDAa_EOITHWr6u8q2UJL_6fToQTHyg9LES-Y0VI5TqiDcyd1sVT6LscKzrb4Ylx_xoJgwTpFI5HL8tnTRJRltuEnOYbf_Bjt00_CEJa6rZAiTZuiwsFUdvtFBbqwpXLqE6ad2R8OB9lEiCEhWqOpbSW7oSw1kdawaFxAlFoIHQZo' },
  { id: 'PC-2401-894', name: 'Amina Osei', age: '6 Yrs', status: 'CRITICAL', type: 'ACTIVE', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2SaIbJg13HuQ8QcMsZJFTXTVijxL9YLCjb5NA3sm_4PQt03ua3Rd2JtBE1OXF87O3QIMw2NvGJcF5uItj1HG1gr8jMsSlG5ew_UEGcm-xUqsote0UKSBBHPcwqvZuauoBX_u8WDesjNIFGi6qFWfvrRIxjQpmboewMFGC4_dNUA7cm7OTbOAzzUxPF6VQQRMw-iwPs4K90FM7w1gEGkJOouBUDihar8SKqL4SovZAU4cC5qNmUD9W8kSkq1ixkECTmtpAo08s6BY' },
  { id: 'PC-2401-895', name: 'Liam O\'Connor', age: '2 Yrs', status: 'STABLE', type: 'ACTIVE', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxiWAyiUE1Rq-7vzKxZuaT3hP7daXnh1gFoWBonxtF9gOMlGI0JrsoEYVn6ZQKAMqiSKX-9A7g9ErKprHSRZp5i6OxxUrra9U4wcg0Ur0MdnVWuqGc9HK24xS0HJ8PGTypbtdT587Lvlkzj1SZ5QCd6LK0if7au-ADsAlIjkAjKMHmybQnf00ssTsebuxNo3Db3aJzMQ7QUVXh-TsfQmx46CP5blCbvp0mor7k5IH4z8tYJqVivA7MSaeL6fad469A7ZVKUvPg9Yw' },
  { id: 'PC-2401-896', name: 'Maya Patel', age: '8 Yrs', status: 'RECOVERY', type: 'ACTIVE', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKUzEZ6iliZPhb0gcBolwq1_W72b3ZTJCXH7HKSfSictKyMLHUdJ1gbRHwnkOevxjacc4uZ2XM9e7FRdydoI04_rWd6q2C1MjN8ypGcDCdRYnKYtBrEORlkTD2qjLGf3uCCZK4t3XvvVFGUkYV5VW-4K4GWa1akkks9HkPS5INvYV-guiJEKSqKhQcxnD6KEqVLlQ_H6VBBKQbHfAckrEFHrr6xeN2mHDxZjrGx-IVh2q0RvUIzdBx3j8eiGFNfEt79fyPyezxQmY' },
];

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showLabNotification, setShowLabNotification] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'offline'>(navigator.onLine ? 'synced' : 'offline');
  const [notificationData, setNotificationData] = useState({ patient: 'Amina Osei', test: 'HÉMATOLOGIE_CBC' });
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [userRole, setUserRole] = useState<'Médecin' | 'Infirmière' | 'Technicien Labo' | 'Directeur' | 'Administrateur technique'>('Infirmière');
  const [pings, setPings] = useState([
    { id: 1, from: 'Dr. Diallo', message: 'Besoin vitaux Lit P-07', time: '14:48', read: false },
    { id: 2, from: 'Labo', message: 'NFS disponible Amadou', time: '14:40', read: true }
  ]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [emergencyAlert, setEmergencyAlert] = useState<{
    isActive: boolean;
    patientId: string | null;
    patientName: string | null;
    bed: string | null;
    reportedBy: string | null;
    time: string | null;
    isResolved: boolean;
    resolvedTime: string | null;
  }>({
    isActive: false,
    patientId: null,
    patientName: null,
    bed: null,
    reportedBy: null,
    time: null,
    isResolved: false,
    resolvedTime: null
  });

  const triggerEmergency = (patientId: string, name: string, bed: string) => {
    setEmergencyAlert({
      isActive: true,
      patientId,
      patientName: name,
      bed,
      reportedBy: userRole === 'Médecin' ? 'Dr. Moussa Diallo' : userRole === 'Directeur' ? 'Dr. Sarah Faye' : 'Inf. Fatou Sow',
      time: '14h32',
      isResolved: false,
      resolvedTime: null
    });
  };

  const dismissEmergency = () => {
    if (userRole === 'Médecin' || userRole === 'Directeur') {
      setEmergencyAlert(prev => ({
        ...prev,
        isActive: false,
        isResolved: true,
        resolvedTime: '14h45'
      }));
      
      // Auto clear after 5 mins (simulated here with 30s for demo)
      setTimeout(() => {
        setEmergencyAlert(prev => ({ ...prev, isResolved: false }));
      }, 30000);
    }
  };

  // Simulation: Trigger Lab Notification after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLabNotification(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // Sync Status Logic
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('pending');
      // Simulate sync process
      setTimeout(() => setSyncStatus('synced'), 2000);
    };
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Search: /
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // New Consultation: N (only on record view)
      if (e.key.toLowerCase() === 'n' && currentView === 'record' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.getAttribute('contenteditable') !== 'true') {
        window.dispatchEvent(new CustomEvent('start-new-consultation'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView]);

  // Simulate non-intrusive Lab Notification
  useEffect(() => {
    if (currentView === 'record') {
      const timer = setTimeout(() => setShowLabNotification(true), 12000);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  if (currentView === 'login') {
    return <Login onLogin={(role?: string) => {
      if (role === 'medecin') setUserRole('Médecin');
      else if (role === 'infirmier') setUserRole('Infirmière');
      else if (role === 'technicien_labo') setUserRole('Technicien Labo');
      else if (role === 'directeur' || role === 'chef_de_service') setUserRole('Directeur');
      else if (role === 'admin_tech') setUserRole('Administrateur technique');
      
      setCurrentView('dashboard');
    }} />;
  }

  const filteredPatients = PATIENTS_MOCK.filter(p => 
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) || 
    p.id.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'patients', label: 'File active', icon: Users },
    { id: 'ward', label: 'Lit & Occupation', icon: Bed },
    { id: 'pings', label: 'Coordination', icon: Bell },
    { id: 'lab', label: 'Laboratoire', icon: Beaker },
    { id: 'consultations', label: 'Consultations', icon: Stethoscope, locked: userRole !== 'Médecin' && userRole !== 'Directeur' },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill, locked: userRole !== 'Médecin' && userRole !== 'Directeur' },
    { id: 'vaccinations', label: 'Vaccinations', icon: Syringe },
    { id: 'growth', label: 'Croissance', icon: TrendingUp },
    { id: 'stats', label: 'Statistiques du service', icon: BarChart3, locked: false }, // Let the view handle the overlay but allow clicking
    ...(userRole === 'Administrateur technique' ? [{ id: 'fhir', label: 'Flux FHIR', icon: BarChartHorizontal }] : []),
  ];

  const footerItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard emergencyAlert={emergencyAlert} />;
      case 'lab': return <Laboratory />;
      case 'admission': return <Admission onCancel={() => setCurrentView('dashboard')} />;
      case 'record': return (
        <PatientRecord 
          userRole={userRole} 
          emergencyAlert={emergencyAlert} 
          onTriggerEmergency={() => triggerEmergency('PED-2024-00412', 'Amadou Bah', 'P-07')}
          onDismissEmergency={dismissEmergency}
        />
      );
      case 'stats': return <Stats userRole={userRole} />;
      case 'fhir': return <FhirLog />;
      case 'ward': return <WardMap />;
      case 'pings': return <CoordinationPings pings={pings} setPings={setPings} />;
      case 'consultations': return <Consultations />;
      case 'prescriptions': return <Prescriptions />;
      case 'vaccinations': return <Vaccinations />;
      case 'growth': return <Growth />;
      case 'users': return <UsersView />;
      case 'settings': return <SettingsView />;
      case 'support': return <Support />;
      case 'patients': return (
        <div className="p-10 relative z-10 min-h-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
            <div className="flex items-center gap-4 text-zinc-900 font-black">
              <span className="text-xs uppercase tracking-widest text-zinc-300 font-bold">Répertoire</span>
              <span className="text-zinc-200">/</span>
              <h1 className="text-sm uppercase tracking-wider">File_Active</h1>
            </div>

            <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="relative group flex-1 md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="FILTRER_NOM_OU_ID [/]"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 text-[10px] font-mono focus:outline-none focus:border-zinc-900 transition-all uppercase tracking-widest placeholder:text-zinc-300"
                />
              </div>
              <button 
                onClick={() => setCurrentView('admission')}
                className="bg-zinc-900 text-white text-[10px] px-8 py-3 uppercase tracking-widest font-black hover:bg-zinc-700 transition-all shadow-sm flex items-center gap-3 shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                NOUVEL_ADMISSION [Alt+N]
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <div 
                  key={patient.id}
                  onClick={() => setCurrentView('record')}
                  className="bg-white border border-zinc-200 p-8 shadow-sm relative group cursor-pointer hover:border-zinc-900 transition-all overflow-hidden h-fit"
                >
                  <div className="absolute top-0 left-0 w-full h-8 border-b border-zinc-100 flex items-center px-3 gap-1 bg-zinc-50/50">
                    <div className="w-2 h-2 rounded-full bg-zinc-200"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-200"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-200"></div>
                  </div>
                  <div className="mt-12 flex flex-col items-center">
                    <div className="w-24 h-24 bg-zinc-50 border border-zinc-200 rounded-full mb-6 overflow-hidden flex items-center justify-center grayscale group-hover:grayscale-0 transition-all">
                      <img src={patient.avatar} alt={patient.name} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-tight text-center">{patient.name}</h3>
                    <p className="text-[10px] text-zinc-400 font-mono mt-2 uppercase tracking-widest">ID: {patient.id} • {patient.age}</p>
                    <div className="mt-6 flex flex-col gap-2 w-full">
                      <div className="h-1 bg-zinc-900 w-full"></div>
                      <div className="h-0.5 bg-zinc-100 w-full"></div>
                      <div className="h-0.5 bg-zinc-100 w-3/4"></div>
                    </div>
                    <div className="mt-8 flex justify-between w-full">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 font-mono",
                        patient.status === 'CRITICAL' ? "bg-zinc-900 text-white" : "bg-zinc-100"
                      )}>{patient.status}</span>
                      <span className="text-[10px] border border-zinc-200 px-2 py-0.5 font-mono uppercase">{patient.type}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-zinc-50 border border-dashed border-zinc-200">
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.3em]">Aucun_Patient_Trouvé [Query: "{patientSearch}"]</p>
              </div>
            )}
          </div>
        </div>
      );
      default: return (
        <div className="flex items-center justify-center h-full text-zinc-400 relative z-10">
          <div className="text-center font-mono text-[10px] uppercase tracking-[0.3em]">
            Vue_Non_Implémentée_v1.0
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden">
      {/* Conflict Resolver Overlay */}
      {showConflicts && <ConflictResolver />}

      {/* Emergency Banner */}
      <AnimatePresence>
        {emergencyAlert.isActive && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[200] bg-red-600 text-white overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-10 py-6 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="w-12 h-12 bg-white/20 flex items-center justify-center animate-pulse">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">URGENCE_SIGNALÉE</span>
                  <p className="text-sm font-black uppercase tracking-tight">
                    Lit {emergencyAlert.bed} — {emergencyAlert.patientName} — Signalé par {emergencyAlert.reportedBy} — {emergencyAlert.time}
                  </p>
                </div>
                <div className="h-10 w-px bg-white/20"></div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Médecin de garde notifié</span>
                </div>
              </div>
              
              {(userRole === 'Médecin' || userRole === 'Directeur') && (
                <button 
                  onClick={dismissEmergency}
                  className="bg-white text-red-600 px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all flex items-center gap-2"
                >
                  DÉSACTIVER_L_ALERTE ×
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lab Notification Banner */}
      <AnimatePresence>
        {showLabNotification && (
          <motion.div 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-4 pointer-events-none"
          >
            <div 
              onClick={() => {
                setShowLabNotification(false);
                setCurrentView('record');
              }}
              className="bg-amber-500 text-white px-8 py-4 shadow-2xl flex items-center gap-6 cursor-pointer pointer-events-auto border-b-4 border-amber-600 rounded-none group"
            >
              <div className="w-10 h-10 bg-white/20 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">ALERTE_LABORATOIRE</span>
                <span className="text-xs font-black uppercase">{notificationData.patient} — {notificationData.test}</span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLabNotification(false);
                  setCurrentView('lab');
                }}
                className="bg-white/10 px-4 py-2 text-[10px] font-black hover:bg-white/20 transition-all uppercase outline-none"
              >
                CONSULTER_LAB
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowLabNotification(false); }} className="ml-4 opacity-50 hover:opacity-100 text-xl">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-[280px] bg-[#1A2332] flex flex-col z-50 text-white shrink-0">
        <div className="p-8 border-b border-white/5">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-[#1A6FD4] flex items-center justify-center font-black text-xl">P</div>
             <h1 className="text-xl font-bold tracking-tight">Pédiatrix</h1>
           </div>
           
           <div className="flex flex-col group cursor-pointer" onClick={() => {
             const roles: ('Médecin' | 'Infirmière' | 'Technicien Labo' | 'Directeur' | 'Administrateur technique')[] = ['Médecin', 'Infirmière', 'Technicien Labo', 'Directeur', 'Administrateur technique'];
             const nextIdx = (roles.indexOf(userRole) + 1) % roles.length;
             setUserRole(roles[nextIdx]);
           }}>
             <span className="text-sm font-bold text-white tracking-tight">
               {userRole === 'Technicien Labo' ? 'Koffi Mensah' : userRole === 'Médecin' ? 'Dr. Moussa Diallo' : userRole === 'Directeur' ? 'Dr. Sarah Faye' : userRole === 'Administrateur technique' ? 'Admin_Sys' : 'Fatou Sow'}
             </span>
             <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest leading-none mt-1">
               {userRole} — Service Pédiatrie
             </span>
             <div className="text-[7px] text-zinc-600 mt-2 font-mono uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity underline">Changer le rôle</div>
           </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map(item => (
            <button 
              key={item.id}
              disabled={item.locked}
              onClick={() => setCurrentView(item.id as ViewType)}
              title={item.locked ? (item.id === 'consultations' ? 'Réservé au médecin' : 'Accès restreint') : ''}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 group transition-all",
                currentView === item.id 
                  ? "bg-[#1A6FD4] text-white shadow-lg shadow-blue-500/20" 
                  : "text-zinc-400 hover:bg-white/5 hover:text-white",
                item.locked && "opacity-40 cursor-not-allowed hover:bg-transparent"
              )}
            >
              <div className="flex items-center gap-4">
                <item.icon className={cn(
                  "w-5 h-5",
                  currentView === item.id ? "text-white" : "text-zinc-500 group-hover:text-white transition-colors",
                  item.locked && "text-zinc-600 group-hover:text-zinc-600"
                )} />
                <div className="relative">
                  <span className={cn(
                    "text-[11px] font-bold uppercase tracking-widest",
                    item.locked && "text-zinc-500"
                  )}>{item.label}</span>
                  {item.id === 'dashboard' && emergencyAlert.isActive && (
                    <div className="absolute -top-1 -right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {item.locked && <Lock className="w-3 h-3 text-zinc-600" />}
                {item.id === 'patients' && (
                  <span className="bg-white/20 text-white text-[9px] font-black px-2 py-0.5 rounded-full">8</span>
                )}
                {item.id === 'vitaux' && (
                  <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">4</span>
                )}
                {item.id === 'lab' && (
                  <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">3</span>
                )}
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-1">
           {footerItems.map(item => (
            <button 
              key={item.id}
              onClick={() => setCurrentView(item.id as ViewType)}
              className="w-full flex items-center gap-4 px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">{item.label}</span>
            </button>
           ))}
           <button 
            onClick={() => setCurrentView('login')}
            className="w-full flex items-center gap-4 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-all mt-4"
           >
            <LogOut className="w-5 h-5" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Déconnexion</span>
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none dot-grid z-0"></div>

        {/* Header */}
        <header className="h-20 border-b border-zinc-200 px-10 flex items-center justify-between bg-white/80 backdrop-blur-md relative z-40 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-zinc-400 font-semibold">PediCare Africa</span>
            <span className="text-zinc-300 font-mono">/</span>
            <span className="text-xs font-black tracking-tight text-zinc-900 uppercase tracking-widest">Node_Dakar_v2.0</span>
          </div>
          
          <div className="flex items-center gap-10">
            {/* Sync Logic */}
            <div className={cn(
              "flex items-center gap-3 px-4 py-2 border transition-all duration-500",
              syncStatus === 'synced' ? "bg-green-50/50 border-green-100 text-green-700" : 
              syncStatus === 'pending' ? "bg-amber-50/50 border-amber-100 text-amber-700" : 
              "bg-red-50 border-red-100 text-red-600"
            )}>
               <div className={cn(
                 "w-2 h-2 rounded-full transition-all duration-500",
                 syncStatus === 'synced' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : 
                 syncStatus === 'pending' ? "bg-amber-500 animate-pulse" : 
                 "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
               )}></div>
               <span className="text-[10px] font-mono uppercase tracking-widest font-black uppercase">
                 {syncStatus === 'synced' ? 'Synchronisé' : 
                  syncStatus === 'pending' ? 'Sync_En_Cours' : 
                  'Hors_Ligne'}
               </span>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative group hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="RECHERCHE [/]"
                  className="pl-9 pr-4 py-1.5 bg-zinc-50 border border-zinc-200 text-[10px] font-mono focus:outline-none focus:border-zinc-900 transition-all w-48 uppercase tracking-widest placeholder:text-zinc-300"
                />
              </div>
              <div className="text-[10px] font-mono bg-zinc-100 px-4 py-1.5 border border-zinc-200 hidden sm:block font-bold">
                DAKAR: 14:32
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto relative z-10 h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.005 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Info Rail */}
        <footer className="h-12 border-t border-zinc-200 bg-white px-10 flex items-center justify-between relative z-40 shrink-0">
          <div className="flex gap-8 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            <span 
              onClick={() => setShowConflicts(true)}
              className={cn(
                "transition-colors flex items-center gap-2 cursor-pointer hover:bg-zinc-50 px-2 -ml-2",
                syncStatus === 'offline' ? "text-red-500 font-black" : "text-zinc-500"
              )}
            >
              Status: {syncStatus === 'synced' ? 'Sync_Success' : syncStatus === 'pending' ? 'Updating...' : 'Network_Error'}
              <RefreshCcw className={cn("w-3 h-3", syncStatus === 'pending' && "animate-spin")} />
            </span>
            <span className="hidden sm:inline">User: Admin_System</span>
            <span className="hidden md:inline">Node: European-West-2</span>
          </div>
          <div className="flex gap-4">
            <div className="w-3 h-3 bg-zinc-900"></div>
            <div className="w-3 h-3 bg-zinc-300"></div>
            <div className="w-3 h-3 bg-zinc-100"></div>
          </div>
        </footer>
      </main>
    </div>
  );
}
