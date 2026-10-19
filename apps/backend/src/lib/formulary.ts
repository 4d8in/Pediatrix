// Formulaire pharmaceutique de l'établissement : médicaments essentiels de
// pédiatrie courants en Afrique de l'Ouest, avec leur unité de délivrance et un
// seuil de réapprovisionnement. Liste de départ, identifiée de mémoire et à
// faire valider par le pharmacien responsable avant un usage réel ; les codes
// sont locaux (aucune terminologie nationale n'est imposée).
export const FORMULARY_SYSTEM = "http://pediatrix.local/fhir/formulary";

export interface FormularyItem {
  code: string;
  name: string;
  form: string;
  // Unité de comptage du stock et de la délivrance (boîte, flacon, comprimé…).
  unit: string;
  // En dessous de ce stock, l'article est signalé "à réapprovisionner".
  reorderLevel: number;
}

export const FORMULARY: FormularyItem[] = [
  { code: "PARA-SIR", name: "Paracétamol sirop 120 mg/5 mL", form: "sirop", unit: "flacon", reorderLevel: 30 },
  { code: "PARA-CP", name: "Paracétamol 500 mg", form: "comprimé", unit: "comprimé", reorderLevel: 200 },
  { code: "IBU-SIR", name: "Ibuprofène sirop 100 mg/5 mL", form: "sirop", unit: "flacon", reorderLevel: 20 },
  { code: "AMOX-SUS", name: "Amoxicilline suspension 125 mg/5 mL", form: "suspension", unit: "flacon", reorderLevel: 30 },
  { code: "AMOX-DISP", name: "Amoxicilline 250 mg dispersible", form: "comprimé", unit: "comprimé", reorderLevel: 200 },
  { code: "COTRI-SIR", name: "Cotrimoxazole sirop", form: "sirop", unit: "flacon", reorderLevel: 20 },
  { code: "ACT-20-120", name: "Artéméther-luméfantrine 20/120 mg dispersible", form: "comprimé", unit: "comprimé", reorderLevel: 240 },
  { code: "SRO", name: "Sels de réhydratation orale (SRO)", form: "sachet", unit: "sachet", reorderLevel: 100 },
  { code: "ZINC-20", name: "Zinc 20 mg dispersible", form: "comprimé", unit: "comprimé", reorderLevel: 200 },
  { code: "ALBEN-400", name: "Albendazole 400 mg", form: "comprimé", unit: "comprimé", reorderLevel: 50 },
  { code: "VIT-A", name: "Vitamine A 100 000 UI", form: "capsule", unit: "capsule", reorderLevel: 100 },
  { code: "FER-FOL", name: "Fer + acide folique sirop", form: "sirop", unit: "flacon", reorderLevel: 20 },
  { code: "SALB-AER", name: "Salbutamol aérosol-doseur", form: "aérosol", unit: "flacon", reorderLevel: 10 },
  { code: "CEFTRI-1G", name: "Ceftriaxone 1 g injectable", form: "injectable", unit: "flacon", reorderLevel: 20 },
  { code: "GENTA-80", name: "Gentamicine 80 mg injectable", form: "injectable", unit: "ampoule", reorderLevel: 20 },
];

export function findFormularyItem(code: string): FormularyItem | undefined {
  return FORMULARY.find((item) => item.code === code);
}
