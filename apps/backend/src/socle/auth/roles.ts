export const ROLES = ["nurse", "doctor", "lab_tech", "director", "tech_admin"] as const;

export type Role = (typeof ROLES)[number];

// Système de code local pour le PractitionerRole.code (pas de terminologie
// standard FHIR pour ces rôles hospitaliers).
export const ROLE_CODE_SYSTEM = "http://pediatrix.local/fhir/role";

export const ROLE_LABELS: Record<Role, string> = {
  nurse: "Infirmière",
  doctor: "Médecin",
  lab_tech: "Technicien Labo",
  director: "Directeur",
  tech_admin: "Administrateur technique",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
