// Catalogue des examens de laboratoire courants en pédiatrie, partagé entre la
// demande (module Pédiatrie) et la saisie des résultats (module Laboratoire).
// Les codes LOINC et les unités UCUM sont ceux des analyses les plus fréquentes ;
// ils ont été identifiés de mémoire et sont à revérifier avant un usage réel.
//
// Volontairement SANS valeurs de référence : elles dépendent de l'âge, de la
// méthode et de l'automate. Le technicien les saisit avec le résultat (comme
// dans OpenELIS, où elles sont paramétrées par le laboratoire).
export const LOINC_SYSTEM = "http://loinc.org";
export const UCUM_SYSTEM = "http://unitsofmeasure.org";

export interface LabTest {
  code: string;
  display: string;
  // Unité UCUM, absente pour un examen purement qualitatif.
  unit?: string;
}

export interface LabCatalogEntry extends LabTest {
  // Pour un panel (ex. NFS) : codes des analyses à saisir.
  panel?: string[];
}

const ANALYTES: LabTest[] = [
  { code: "718-7", display: "Hémoglobine", unit: "g/dL" },
  { code: "6690-2", display: "Leucocytes", unit: "10*3/uL" },
  { code: "777-3", display: "Plaquettes", unit: "10*3/uL" },
  { code: "4544-3", display: "Hématocrite", unit: "%" },
  { code: "2345-7", display: "Glycémie", unit: "mg/dL" },
  { code: "1988-5", display: "Protéine C réactive (CRP)", unit: "mg/L" },
  { code: "2160-0", display: "Créatinine", unit: "mg/dL" },
];

export const LAB_CATALOG: LabCatalogEntry[] = [
  { code: "58410-2", display: "Numération formule sanguine (NFS)", panel: ["718-7", "6690-2", "777-3", "4544-3"] },
  ...ANALYTES,
];

export function findCatalogEntry(code: string): LabCatalogEntry | undefined {
  return LAB_CATALOG.find((entry) => entry.code === code);
}
