// Modèle FHIR de la gestion des lits.
// - Service (Pédiatrie, Néonatologie…) = Location, physicalType "wa" (ward).
// - Lit = Location, physicalType "bd" (bed), partOf = son service.
//   Son état est porté par Location.operationalStatus (table HL7 v2 0116) :
//   U = libre, O = occupé, H = en nettoyage, C = fermé / hors service.
// - Séjour (hospitalisation) = Encounter de classe "IMP" (inpatient), distinct
//   des consultations (classe "AMB"), avec le lit dans Encounter.location.

export const BED_STATUS_SYSTEM = "http://terminology.hl7.org/CodeSystem/v2-0116";
export const INPATIENT_CLASS = { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IMP", display: "inpatient encounter" };

export type BedStatus = "U" | "O" | "H" | "C";

export const BED_STATUS_LABELS: Record<BedStatus, string> = {
  U: "Libre",
  O: "Occupé",
  H: "En nettoyage",
  C: "Fermé",
};

export interface FhirLocation {
  resourceType: "Location";
  id: string;
  name?: string;
  status?: string;
  operationalStatus?: { system?: string; code?: string; display?: string };
  physicalType?: { coding?: { code?: string }[] };
  partOf?: { reference?: string };
  [key: string]: unknown;
}

export interface FhirStay {
  resourceType: "Encounter";
  id: string;
  status?: string;
  subject?: { reference?: string };
  reasonCode?: { text?: string }[];
  period?: { start?: string; end?: string };
  location?: { location?: { reference?: string }; status?: string; period?: { start?: string; end?: string } }[];
  [key: string]: unknown;
}

export function bedStatusOf(bed: FhirLocation): BedStatus {
  const code = bed.operationalStatus?.code;
  return code === "O" || code === "H" || code === "C" ? code : "U";
}

// Renvoie une copie du lit avec le nouvel état (le reste de la ressource est préservé pour le PUT).
export function withBedStatus(bed: FhirLocation, status: BedStatus): FhirLocation {
  return {
    ...bed,
    operationalStatus: { system: BED_STATUS_SYSTEM, code: status, display: BED_STATUS_LABELS[status] },
  };
}

// Lit actuellement occupé par un séjour : la dernière entrée "active" de Encounter.location.
export function currentBedId(stay: FhirStay): string | null {
  const active = stay.location?.find((entry) => entry.status === "active");
  return active?.location?.reference?.replace("Location/", "") ?? null;
}
