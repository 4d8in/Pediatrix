export interface CreatePrescriptionInput {
  medication: string;
  dosage: string;
  // Accord du médecin malgré une allergie connue.
  confirmed?: boolean;
  // Accord distinct pour une alerte de dose.
  doseConfirmed?: boolean;
  // Dose structurée facultative : active le contrôle de la dose quotidienne par kg.
  formularyCode?: string;
  doseMg?: number;
  dosesPerDay?: number;
  // Durée du traitement en jours (facultative) : sert à clore l'échéancier des doses.
  durationDays?: number;
}

export interface PrescriptionSummary {
  id: string;
  date: string | null;
  medication: string | null;
  dosage: string | null;
  allergyOverrideConfirmed: boolean;
}
