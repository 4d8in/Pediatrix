// Codes LOINC des paramètres vitaux pédiatriques, partagés entre l'écriture
// (module Pédiatrie, création des Observation) et la lecture (socle, dossier patient).
export const VITAL_LOINC_CODES = {
  temperature: { code: "8310-5", display: "Température corporelle", unit: "Cel" },
  weight: { code: "29463-7", display: "Poids corporel", unit: "kg" },
  height: { code: "8302-2", display: "Taille", unit: "cm" },
  heartRate: { code: "8867-4", display: "Fréquence cardiaque", unit: "/min" },
  respiratoryRate: { code: "9279-1", display: "Fréquence respiratoire", unit: "/min" },
} as const;

export type VitalKey = keyof typeof VITAL_LOINC_CODES;
