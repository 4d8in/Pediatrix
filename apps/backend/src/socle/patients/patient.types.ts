export type Gender = "male" | "female" | "other" | "unknown";

export interface GuardianInput {
  name: string;
  relationship: string;
  phone: string;
}

export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  birthDate: string; // AAAA-MM-JJ
  gender: Gender;
  guardian: GuardianInput;
}

export interface PatientSummary {
  id: string;
  // Numéro de dossier (identifiant médical de l'établissement), ex. PX-001401.
  mrn: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
  // Date du décès, renseignée à la sortie d'hospitalisation avec l'issue « décédé ».
  deceasedAt?: string;
  guardian: GuardianInput | null;
}
