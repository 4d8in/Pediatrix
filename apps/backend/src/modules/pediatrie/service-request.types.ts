export interface CreateServiceRequestInput {
  exam: string;
  requester: string;
  // Code LOINC de l'examen, si choisi dans le catalogue (lib/lab-catalog.ts).
  examCode?: string;
  // Demande urgente : passe en tête de la file du laboratoire.
  urgent?: boolean;
}
