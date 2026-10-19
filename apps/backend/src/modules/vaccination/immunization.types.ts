export interface CreateImmunizationInput {
  vaccine: string;
  // Code du vaccin du catalogue (lib/vaccines.ts), pour le suivi du calendrier.
  vaccineCode?: string;
  date: string; // AAAA-MM-JJ
  doseNumber?: number;
  notes?: string;
}

export interface ImmunizationSummary {
  id: string;
  date: string | null;
  vaccine: string | null;
  vaccineCode: string | null;
  doseNumber: number | null;
  notes: string | null;
}
