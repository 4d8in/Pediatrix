import { Eye } from "lucide-react";

export default function PreviewBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border border-amber-100 text-amber-700">
      <Eye className="w-4 h-4 shrink-0" />
      <span className="text-[10px] font-black uppercase tracking-widest">
        Aperçu — données de démonstration, écran non connecté au backend
      </span>
    </div>
  );
}
