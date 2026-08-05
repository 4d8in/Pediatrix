export interface CreateImmunizationInput {
  vaccine: string;
  date: string; // AAAA-MM-JJ
  doseNumber?: number;
  notes?: string;
}

export interface ImmunizationSummary {
  id: string;
  date: string | null;
  vaccine: string | null;
  doseNumber: number | null;
  notes: string | null;
}
