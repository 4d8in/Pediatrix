import { useEffect, useState } from "react";
import { Search, User, X } from "lucide-react";
import { ApiError, listPatients } from "../lib/api";
import type { Patient } from "../lib/types";

interface PatientPickerProps {
  selected: Patient | null;
  onSelect: (patient: Patient | null) => void;
  label?: string;
}

export default function PatientPicker({ selected, onSelect, label = "Patient" }: PatientPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
      setError(null);
      listPatients(query.trim())
        .then((data) => setResults(data.patients))
        .catch((err) => setError(err instanceof ApiError ? err.message : "Erreur de recherche."))
        .finally(() => setIsLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selected]);

  if (selected) {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-400">{label}</label>
        <div className="flex items-center justify-between px-5 py-3 bg-zinc-50 border border-zinc-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-100 flex items-center justify-center border border-zinc-200">
              <User className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-900">
                {selected.firstName} {selected.lastName}
              </p>
              <p className="text-xs text-zinc-400">
                ID: {selected.id} — Né(e) le {selected.birthDate}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 relative">
      <label className="text-sm font-medium text-zinc-400">{label}</label>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          data-testid="patient-picker-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un patient par nom"
          className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-sm rounded-xl"
        />
      </div>

      {isLoading && <p className="text-sm text-zinc-400">Recherche...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="border border-zinc-200/70 divide-y divide-zinc-100 bg-white rounded-[18px]">
          {results.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => {
                onSelect(patient);
                setQuery("");
              }}
              className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-zinc-50 transition-colors"
            >
              <User className="w-4 h-4 text-zinc-400" />
              <div>
                <p className="text-xs font-medium text-zinc-900">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-xs text-zinc-400">
                  ID: {patient.id} — Né(e) le {patient.birthDate}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
