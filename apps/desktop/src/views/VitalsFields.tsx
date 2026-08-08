import type { Vitals } from "../lib/types";

interface VitalsFieldsProps {
  vitals: Vitals;
  onChange: (vitals: Vitals) => void;
}

const FIELDS: { key: keyof Vitals; label: string; unit: string; step: string }[] = [
  { key: "temperature", label: "Température", unit: "°C", step: "0.1" },
  { key: "weight", label: "Poids", unit: "kg", step: "0.1" },
  { key: "height", label: "Taille", unit: "cm", step: "0.1" },
  { key: "heartRate", label: "Fréq. cardiaque", unit: "/min", step: "1" },
  { key: "respiratoryRate", label: "Fréq. respiratoire", unit: "/min", step: "1" },
];

export default function VitalsFields({ vitals, onChange }: VitalsFieldsProps) {
  function updateValue(key: keyof Vitals, raw: string) {
    const value = raw === "" ? undefined : Number(raw);
    onChange({ ...vitals, [key]: value });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {field.label} ({field.unit})
          </label>
          <input
            type="number"
            min="0"
            step={field.step}
            data-testid={`vitals-${field.key}`}
            value={vitals[field.key] ?? ""}
            onChange={(event) => updateValue(field.key, event.target.value)}
            className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all font-mono text-xs"
          />
        </div>
      ))}
    </div>
  );
}
