// Diagnostics fréquents en consultation pédiatrique en Afrique de l'Ouest, codés
// CIM-10 (classification de l'OMS). Liste de départ identifiée de mémoire : à
// faire valider par le médecin responsable de l'information médicale avant un
// usage réel. Le médecin peut toujours saisir un diagnostic libre (sans code).
export const ICD10_SYSTEM = "http://hl7.org/fhir/sid/icd-10";

export interface Diagnosis {
  code: string;
  display: string;
}

export const DIAGNOSES: Diagnosis[] = [
  { code: "B50.9", display: "Paludisme à Plasmodium falciparum, sans précision" },
  { code: "B54", display: "Paludisme, sans précision" },
  { code: "J18.9", display: "Pneumonie, sans précision" },
  { code: "J06.9", display: "Infection aiguë des voies respiratoires supérieures" },
  { code: "J03.9", display: "Angine aiguë, sans précision" },
  { code: "J45.9", display: "Asthme, sans précision" },
  { code: "H66.9", display: "Otite moyenne, sans précision" },
  { code: "A09", display: "Diarrhée et gastro-entérite d'origine présumée infectieuse" },
  { code: "E86", display: "Déshydratation" },
  { code: "E43", display: "Malnutrition protéino-énergétique grave, sans précision" },
  { code: "E44.0", display: "Malnutrition protéino-énergétique modérée" },
  { code: "D50.9", display: "Anémie par carence en fer, sans précision" },
  { code: "D57.1", display: "Drépanocytose sans crise" },
  { code: "A01.0", display: "Fièvre typhoïde" },
  { code: "N39.0", display: "Infection des voies urinaires, siège non précisé" },
  { code: "G00.9", display: "Méningite bactérienne, sans précision" },
  { code: "B05.9", display: "Rougeole sans complication" },
  { code: "A37.9", display: "Coqueluche, sans précision" },
  { code: "A15.9", display: "Tuberculose respiratoire, sans précision" },
  { code: "B24", display: "Maladie due au VIH, sans précision" },
  { code: "B76.9", display: "Ankylostomiase, sans précision" },
  { code: "B77.9", display: "Ascaridiase, sans précision" },
  { code: "B86", display: "Gale" },
  { code: "L08.9", display: "Infection locale de la peau et du tissu cellulaire sous-cutané" },
  { code: "P07.3", display: "Autres enfants nés avant terme" },
  { code: "P22.9", display: "Détresse respiratoire du nouveau-né, sans précision" },
  { code: "P36.9", display: "Septicémie bactérienne du nouveau-né, sans précision" },
  { code: "P59.9", display: "Ictère néonatal, sans précision" },
  { code: "R50.9", display: "Fièvre, sans précision" },
  // Maladies à déclaration (surveillance épidémiologique, voir lib/idsr.ts).
  { code: "A00.9", display: "Choléra, sans précision" },
  { code: "A80.9", display: "Poliomyélite aiguë, sans précision" },
  { code: "A36.9", display: "Diphtérie, sans précision" },
  { code: "A33", display: "Tétanos néonatal" },
  { code: "A82.9", display: "Rage, sans précision" },
  { code: "A90", display: "Dengue [dengue classique]" },
  { code: "A39.0", display: "Méningite à méningocoques" },
  { code: "A20.9", display: "Peste, sans précision" },
  { code: "A98.4", display: "Maladie due au virus Ebola" },
  { code: "A95.9", display: "Fièvre jaune, sans précision" },
];

export function findDiagnosis(code: string): Diagnosis | undefined {
  return DIAGNOSES.find((diagnosis) => diagnosis.code === code);
}
