export interface CreateGrowthInput {
  date: string; // AAAA-MM-JJ
  weight?: number; // kg
  height?: number; // cm
  headCircumference?: number; // cm
  muac?: number; // mm (périmètre brachial)
}

export interface GrowthMeasurement {
  date: string;
  weight?: number;
  height?: number;
  headCircumference?: number;
  muac?: number;
  // Classement du PB (6 à 59 mois) ; absent hors de cette tranche d'âge.
  muacStatus?: "severe" | "moderate" | "normal";
}
