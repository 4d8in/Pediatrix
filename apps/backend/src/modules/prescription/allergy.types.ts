export interface CreateAllergyInput {
  substance: string;
  reaction?: string;
}

export interface AllergySummary {
  id: string;
  substance: string | null;
  reaction: string | null;
  recordedDate: string | null;
}
