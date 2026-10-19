export interface LabResultInput {
  label: string;
  value: string;
  // Code LOINC de l'analyse (voir lib/lab-catalog.ts), si elle vient du catalogue.
  code?: string;
  // Unité UCUM et bornes de référence, saisies avec le résultat.
  unit?: string;
  referenceLow?: number;
  referenceHigh?: number;
  // Seuils critiques (drapeaux HH / LL), remplis par le serveur d'après l'âge et le sexe.
  criticalLow?: number;
  criticalHigh?: number;
}

export interface CreateReportInput {
  results: LabResultInput[];
  conclusion?: string;
}
