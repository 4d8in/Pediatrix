import { UserPlus, Search, Shield, ShieldAlert, MoreHorizontal } from "lucide-react";
import PreviewBanner from "../components/PreviewBanner";

const USERS_MOCK = [
  { id: "U-001", name: "Dr. Moussa Diallo", role: "Médecin", status: "Online", permissions: "Full" },
  { id: "U-002", name: "Fatou Sow", role: "Infirmière", status: "Online", permissions: "Clinical" },
  { id: "U-003", name: "Dr. Sarah Faye", role: "Directeur", status: "Away", permissions: "Admin" },
  { id: "U-004", name: "Koffi Mensah", role: "Technicien Labo", status: "Offline", permissions: "Laboratory" },
  { id: "U-005", name: "Admin_Sys", role: "Administrateur technique", status: "Online", permissions: "Root" },
];

export default function Users() {
  return (
    <div className="p-10 space-y-10">
      <PreviewBanner />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Gestion_Des_Utilisateurs</h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Contrôle d'accès & Permissions du personnel
          </p>
        </div>

        <div className="flex gap-4">
          <button className="px-6 py-3 bg-[#1A6FD4] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-3">
            <UserPlus className="w-4 h-4" /> Ajouter Utilisateur
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
          <div className="flex gap-4">
            <button className="text-[10px] font-black uppercase tracking-widest border-b-2 border-zinc-900 pb-1">
              Tous ({USERS_MOCK.length})
            </button>
            <button className="text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-zinc-600 pb-1">
              En poste
            </button>
            <button className="text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-zinc-600 pb-1">
              Audit Log
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
            <input
              type="text"
              placeholder="RECHERCHER..."
              className="pl-9 pr-4 py-2 border border-zinc-200 text-[9px] font-mono focus:outline-none focus:border-zinc-900 transition-all uppercase"
            />
          </div>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50/50 text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
              <th className="px-10 py-5">NOM_UTILISATEUR</th>
              <th className="px-10 py-5">FONCTION</th>
              <th className="px-10 py-5">PERMISSIONS</th>
              <th className="px-10 py-5">DERN_CONNEXION</th>
              <th className="px-10 py-5">STATUT</th>
              <th className="px-10 py-5 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {USERS_MOCK.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-50/10 transition-colors group">
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-900 text-white flex items-center justify-center font-black text-xs">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                        {user.name}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
                        ID: {user.id}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-6 text-[11px] font-bold text-zinc-600 uppercase tracking-widest">
                  {user.role}
                </td>
                <td className="px-10 py-6">
                  <div className="flex items-center gap-2">
                    <Shield className={`w-3 h-3 ${user.permissions === "Root" ? "text-red-500" : "text-blue-500"}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {user.permissions}
                    </span>
                  </div>
                </td>
                <td className="px-10 py-6 text-[10px] font-mono font-bold text-zinc-500">Aujourd'hui, 08:32</td>
                <td className="px-10 py-6">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        user.status === "Online"
                          ? "bg-green-500"
                          : user.status === "Away"
                            ? "bg-amber-500"
                            : "bg-zinc-300"
                      }`}
                    ></div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {user.status}
                    </span>
                  </div>
                </td>
                <td className="px-10 py-6 text-right">
                  <button className="text-zinc-300 hover:text-zinc-900 transition-colors p-2">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-zinc-900 text-white p-10 flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white/10">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Sécurité_Audit_Intégrité</h3>
            <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
              Aucun accès non autorisé détecté ces dernières 72h. Données chiffrées AES-256.
            </p>
          </div>
        </div>
        <button className="px-10 py-4 border border-white/20 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-zinc-900 transition-all">
          Voir Journaux d'Accès
        </button>
      </div>
    </div>
  );
}
