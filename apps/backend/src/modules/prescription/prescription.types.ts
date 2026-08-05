export interface CreatePrescriptionInput {
  medication: string;
  dosage: string;
  confirmed?: boolean;
}

export interface PrescriptionSummary {
  id: string;
  date: string | null;
  medication: string | null;
  dosage: string | null;
  allergyOverrideConfirmed: boolean;
}
