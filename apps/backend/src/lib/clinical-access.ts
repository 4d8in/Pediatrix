import type { Role } from "../socle/auth/roles.js";

// Principe du besoin d'en connaître : seuls les soignants lisent le contenu d'une
// consultation (motif, notes, constantes). Laboratoire, radiologie et direction
// n'ont que l'identité du patient pour retrouver un dossier.
const CLINICAL_READERS: readonly Role[] = ["nurse", "doctor"];

export function canReadClinicalContent(role: Role): boolean {
  return CLINICAL_READERS.includes(role);
}

// Les coordonnées du tuteur ne servent qu'à l'accueil et aux soignants.
const GUARDIAN_READERS: readonly Role[] = ["nurse", "doctor", "receptionist"];

export function canReadGuardian(role: Role): boolean {
  return GUARDIAN_READERS.includes(role);
}
