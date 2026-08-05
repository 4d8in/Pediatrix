export interface CreateGrowthInput {
  date: string; // AAAA-MM-JJ
  weight?: number; // kg
  height?: number; // cm
  headCircumference?: number; // cm
}

export interface GrowthMeasurement {
  date: string;
  weight?: number;
  height?: number;
  headCircumference?: number;
}
