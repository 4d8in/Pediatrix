// Code LOINC identifié de mémoire pour le périmètre crânien — à revérifier
// contre une référence LOINC avant d'être présenté comme définitif dans le mémoire.
export const HEAD_CIRCUMFERENCE_LOINC = {
  code: "9843-4",
  display: "Périmètre crânien",
  unit: "cm",
} as const;

// Discrimine les Observation du module Croissance de celles créées par la
// Pédiatrie (Consultations) : le poids et la taille utilisent les mêmes codes
// LOINC dans les deux cas (voir lib/vitals-codes.ts), donc une simple
// recherche par code+patient verrait aussi les mesures prises en consultation.
// Même principe que SERVICE_CATEGORY_SYSTEM dans lib/service-category.ts,
// appliqué ici à Observation.category plutôt qu'à ServiceRequest.category.
export const GROWTH_CATEGORY_SYSTEM = "http://pediatrix.local/fhir/observation-category";
export const GROWTH_CATEGORY_CODE = "growth";

export const GROWTH_CATEGORY_CODING = {
  system: GROWTH_CATEGORY_SYSTEM,
  code: GROWTH_CATEGORY_CODE,
  display: "Suivi de croissance",
};

export const GROWTH_CATEGORY_SEARCH_TOKEN = `${GROWTH_CATEGORY_SYSTEM}|${GROWTH_CATEGORY_CODE}`;
