export interface CreatePrescriptionInput {
  medication: string;
  dosage: string;
  confirmed?: boolean;
  // Dose structurée facultative : active le contrôle de la dose quotidienne par kg.
  formularyCode?: string;
  doseMg?: number;
  dosesPerDay?: number;
}

export interface PrescriptionSummary {
  id: string;
  date: string | null;
  medication: string | null;
  dosage: string | null;
  allergyOverrideConfirmed: boolean;
}
