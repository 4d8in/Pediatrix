import { useState } from "react";
import { Send, Bell, User } from "lucide-react";
import PreviewBanner from "../components/PreviewBanner";

interface Ping {
  id: number;
  from: string;
  message: string;
  time: string;
}

const PINGS_MOCK: Ping[] = [
  { id: 1, from: "Dr. Diallo", message: "Besoin vitaux Lit P-07", time: "14:48" },
  { id: 2, from: "Labo", message: "NFS disponible Amadou", time: "14:40" },
];

const TEAM_MOCK = [
  { name: "Dr. Diallo", role: "Médecin", status: "In-Ward" },
  { name: "Inf. Sow", role: "Infirmier", status: "Available" },
  { name: "Dr. Faye", role: "Directeur", status: "Meeting" },
];

export default function CoordinationPings() {
  const [pings, setPings] = useState<Ping[]>(PINGS_MOCK);
  const [newMessage, setNewMessage] = useState("");

  function sendPing() {
    if (!newMessage.trim()) return;
    setPings([{ id: Date.now(), from: "Moi", message: newMessage, time: "À l'instant" }, ...pings]);
    setNewMessage("");
  }

  return (
    <div className="h-full flex flex-col p-10 space-y-10">
      <PreviewBanner />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Coordination_Intra_Service</h1>
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
            Communication rapide entre praticiens
          </p>
        </div>
        <div className="px-4 py-2 bg-blue-50 border border-blue-100 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Canal: Pédiatrie A</span>
        </div>
      </div>

      <div className="flex-1 flex gap-10 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-y-auto p-10 space-y-8">
            {pings.map((ping) => (
              <div key={ping.id} className={`flex gap-6 max-w-2xl ${ping.from === "Moi" ? "ml-auto flex-row-reverse" : ""}`}>
                <div className="w-10 h-10 bg-zinc-900 text-white flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <div className={`flex items-center gap-4 ${ping.from === "Moi" ? "flex-row-reverse" : ""}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">{ping.from}</span>
                    <span className="text-[9px] font-mono text-zinc-300">{ping.time}</span>
                  </div>
                  <div
                    className={`p-5 text-sm font-bold shadow-sm ${
                      ping.from === "Moi" ? "bg-zinc-900 text-white" : "bg-zinc-50 border border-zinc-100 text-zinc-900"
                    }`}
                  >
                    {ping.message}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-8 border-t border-zinc-100 bg-zinc-50/50">
            <div className="flex gap-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendPing()}
                placeholder="ENVOYER_UN_PING_RAPIDE..."
                className="flex-1 bg-white border border-zinc-200 px-6 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:border-zinc-900 transition-all"
              />
              <button
                onClick={sendPing}
                className="bg-zinc-900 text-white px-8 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center gap-3"
              >
                <Send className="w-4 h-4" /> Envoyer
              </button>
            </div>
          </div>
        </div>

        <div className="w-80 space-y-10">
          <div className="bg-white border border-zinc-200 p-8 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Équipe_Présente</h3>
            <div className="space-y-4">
              {TEAM_MOCK.map((staff) => (
                <div key={staff.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">{staff.name}</span>
                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">{staff.role}</span>
                    </div>
                  </div>
                  <span className="text-[8px] font-black text-zinc-300 uppercase opacity-0 group-hover:opacity-100">
                    Ping?
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <Bell className="w-8 h-8 text-zinc-300" />
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-relaxed">
              Activez les notifications bureau pour ne manquer aucune urgence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
