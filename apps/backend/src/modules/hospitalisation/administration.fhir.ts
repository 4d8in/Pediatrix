// Suivi d'administration des médicaments pendant un séjour (MedicationAdministration FHIR) :
// chaque prise donnée ou non donnée (avec motif) est tracée avec l'infirmier et l'heure.
export interface FhirAdministration {
  resourceType: "MedicationAdministration";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  effectiveDateTime?: string;
  request?: { reference?: string };
  performer?: { actor?: { display?: string } }[];
  note?: { text?: string }[];
}

export interface AdministrationSummary {
  id: string;
  prescriptionId: string | null;
  medication: string | null;
  given: boolean;
  at: string | null;
  by: string | null;
  note: string | null;
}

export function toFhirAdministration(args: {
  patientId: string;
  stayId: string;
  prescriptionId: string;
  medication: string;
  given: boolean;
  note?: string;
  performer: { id: string; name: string };
  at: string;
}) {
  return {
    resourceType: "MedicationAdministration" as const,
    status: args.given ? "completed" : "not-done",
    medicationCodeableConcept: { text: args.medication },
    subject: { reference: `Patient/${args.patientId}` },
    context: { reference: `Encounter/${args.stayId}` },
    request: { reference: `MedicationRequest/${args.prescriptionId}` },
    effectiveDateTime: args.at,
    performer: [{ actor: { display: args.performer.name } }],
    note: args.note ? [{ text: args.note }] : undefined,
  };
}

export function fromFhirAdministrations(bundle: { entry?: { resource: FhirAdministration }[] }): AdministrationSummary[] {
  return (bundle.entry ?? [])
    .map((e) => e.resource)
    .map((r) => ({
      id: r.id ?? "",
      prescriptionId: r.request?.reference?.split("/")[1] ?? null,
      medication: r.medicationCodeableConcept?.text ?? null,
      given: r.status === "completed",
      at: r.effectiveDateTime ?? null,
      by: r.performer?.[0]?.actor?.display ?? null,
      note: r.note?.[0]?.text ?? null,
    }))
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}
