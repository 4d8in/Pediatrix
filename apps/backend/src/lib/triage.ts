// Tri à l'arrivée selon la logique ETAT de l'OMS (Triage et traitement d'urgence) :
// signes d'urgence (immédiat), signes de priorité (vu en premier), non urgent.
export const TRIAGE_SYSTEM = "http://pediatrix.local/fhir/triage";
export const TRIAGE_CATEGORIES = ["emergency", "priority", "non_urgent"] as const;
export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];

export const TRIAGE_LABELS: Record<TriageCategory, string> = {
  emergency: "Urgence",
  priority: "Prioritaire",
  non_urgent: "Non urgent",
};

export function isTriageCategory(value: unknown): value is TriageCategory {
  return typeof value === "string" && (TRIAGE_CATEGORIES as readonly string[]).includes(value);
}

// Ordre de passage : urgence, prioritaire, pas encore trié (à trier vite), non urgent.
export function triageRank(category: TriageCategory | null): number {
  switch (category) {
    case "emergency":
      return 0;
    case "priority":
      return 1;
    case null:
      return 2;
    case "non_urgent":
      return 3;
  }
}

export function toTriageObservation(
  patientId: string,
  encounterId: string,
  category: TriageCategory,
  note: string | undefined,
  nurse: { id: string; name: string },
  at?: string,
) {
  return {
    resourceType: "Observation",
    status: "final",
    code: { coding: [{ system: TRIAGE_SYSTEM, code: "triage-category", display: "Catégorie de tri" }] },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    effectiveDateTime: at ?? new Date().toISOString(),
    performer: [{ reference: `Practitioner/${nurse.id}`, display: nurse.name }],
    valueCodeableConcept: { coding: [{ system: TRIAGE_SYSTEM, code: category, display: TRIAGE_LABELS[category] }] },
    note: note ? [{ text: note }] : undefined,
  };
}

interface FhirTriageObservation {
  encounter?: { reference?: string };
  subject?: { reference?: string };
  effectiveDateTime?: string;
  valueCodeableConcept?: { coding?: { code?: string }[] };
}

// Dernier tri par consultation (clé = id d'Encounter).
export function latestTriageByEncounter(observations: FhirTriageObservation[]): Map<string, TriageCategory> {
  const sorted = [...observations].sort((a, b) => (a.effectiveDateTime ?? "").localeCompare(b.effectiveDateTime ?? ""));
  const result = new Map<string, TriageCategory>();
  for (const obs of sorted) {
    const encounterId = obs.encounter?.reference?.split("/")[1];
    const code = obs.valueCodeableConcept?.coding?.[0]?.code;
    if (encounterId && isTriageCategory(code)) result.set(encounterId, code);
  }
  return result;
}
