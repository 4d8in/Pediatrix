import type { Role } from "./types";

// Libellés affichés des rôles (une seule source pour toute l'interface).
export const ROLE_LABELS: Record<Role, string> = {
  nurse: "Infirmière",
  doctor: "Médecin",
  lab_tech: "Technicien labo",
  radiologist: "Radiologue",
  pharmacist: "Pharmacien",
  cashier: "Caissier",
  receptionist: "Réceptionniste",
  director: "Directeur",
  tech_admin: "Administrateur technique",
};
