import { MessageSquare, LifeBuoy, FileText, ExternalLink, Mail, Phone, ChevronRight } from "lucide-react";
import PreviewBanner from "../components/PreviewBanner";

const CARDS = [
  { title: "Base de Connaissances", desc: "Guides d'utilisation et protocoles", icon: FileText, color: "blue" },
  { title: "Chat en Direct", desc: "Assistance immédiate (8h-18h)", icon: MessageSquare, color: "green" },
  { title: "Tutoriels Vidéo", desc: "Formation aux nouvelles fonctionnalités", icon: ExternalLink, color: "purple" },
  { title: "État du Réseau", desc: "Vérifier la connectivité des serveurs", icon: LifeBuoy, color: "amber" },
];

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  purple: "bg-purple-50 text-purple-600",
  amber: "bg-amber-50 text-amber-600",
};

export default function Support() {
  return (
    <div className="p-10 space-y-10">
      <PreviewBanner />

      <div className="space-y-1">
        <h1 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900">Centre_De_Support_Technique</h1>
        <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
          Assistance • Documentation • Ticket d'incident
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {CARDS.map((card) => (
              <button
                key={card.title}
                className="bg-white border border-zinc-200 p-8 text-left group hover:border-zinc-900 transition-all flex flex-col gap-6 shadow-sm"
              >
                <div
                  className={`w-12 h-12 flex items-center justify-center transition-all group-hover:scale-110 ${COLOR_CLASSES[card.color]}`}
                >
                  <card.icon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-[11px] font-black uppercase tracking-tight text-zinc-900">{card.title}</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest italic">{card.desc}</p>
                </div>
                <div className="mt-auto pt-4 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-zinc-300 group-hover:text-zinc-900 transition-colors">
                  Accéder au module <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>

          <div className="bg-white border border-zinc-200 p-10 space-y-10">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ouvrir_Un_Ticket</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                    Service Concerné
                  </label>
                  <select className="w-full bg-zinc-50 border border-zinc-200 px-6 py-3 text-[10px] font-bold uppercase outline-none focus:border-zinc-900 rounded-none appearance-none">
                    <option>SYSTÈME (CRASH/BUG)</option>
                    <option>CLINIQUE (DONNÉES)</option>
                    <option>MATÉRIEL (TABLETTE...)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                    Priorité
                  </label>
                  <select className="w-full bg-zinc-50 border border-zinc-200 px-6 py-3 text-[10px] font-bold uppercase outline-none focus:border-zinc-900 rounded-none appearance-none">
                    <option>Basse</option>
                    <option>Moyenne</option>
                    <option className="text-red-600">CRITIQUE_BLOQUANT</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                  Description de l'incident
                </label>
                <textarea
                  placeholder="VEUILLEZ_DÉCRIRE_L_ANOMALIE..."
                  className="w-full h-32 bg-zinc-50 border border-zinc-200 p-6 text-xs font-bold focus:outline-none focus:border-zinc-900 transition-all rounded-none resize-none"
                />
              </div>
              <button className="w-full py-4 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all shadow-lg">
                Envoyer_Ticket_Support
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-zinc-900 text-white p-10 space-y-10">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Coordonnées_Urgence_Tech
            </h3>
            <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div className="w-10 h-10 bg-white/5 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Hotline 24/7</span>
                  <p className="text-sm font-bold">+221 33 800 00 00</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-10 h-10 bg-white/5 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Email</span>
                  <p className="text-sm font-bold">support@pediatrix.sn</p>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-white/5 text-center">
              <p className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest leading-relaxed">
                © 2026 PÉDIATRIX Africa • Systèmes de santé résilients
              </p>
            </div>
          </div>

          <div className="border border-zinc-200 p-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Version_Build</span>
              <span className="text-[10px] font-mono font-bold text-zinc-900">v0.1.0-proto</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
