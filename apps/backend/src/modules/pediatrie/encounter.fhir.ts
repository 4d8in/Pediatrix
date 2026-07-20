import { randomUUID } from "node:crypto";
import { VITAL_LOINC_CODES, type VitalKey } from "../../lib/vitals-codes.js";
import type { CreateEncounterInput } from "./encounter.types.js";

// Encounter + Observations sont envoyés en un seul Bundle FHIR "transaction" :
// soit toutes les ressources sont créées, soit aucune (atomicité gérée par HAPI,
// pas de rollback applicatif à écrire côté backend).
export function toEncounterTransactionBundle(patientId: string, input: CreateEncounterInput) {
  const patientRef = `Patient/${patientId}`;
  const encounterFullUrl = `urn:uuid:${randomUUID()}`;
  const now = new Date().toISOString();

  const entries: unknown[] = [
    {
      fullUrl: encounterFullUrl,
      resource: {
        resourceType: "Encounter",
        status: "finished",
        class: { code: "AMB", display: "ambulatory" },
        subject: { reference: patientRef },
        reasonCode: [{ text: input.reason }],
        period: { start: now, end: now },
      },
      request: { method: "POST", url: "Encounter" },
    },
  ];

  for (const key of Object.keys(input.vitals) as VitalKey[]) {
    const value = input.vitals[key];
    if (value === undefined) continue;
    const meta = VITAL_LOINC_CODES[key];

    entries.push({
      fullUrl: `urn:uuid:${randomUUID()}`,
      resource: {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: meta.code, display: meta.display }] },
        subject: { reference: patientRef },
        encounter: { reference: encounterFullUrl },
        effectiveDateTime: now,
        valueQuantity: { value, unit: meta.unit, system: "http://unitsofmeasure.org", code: meta.unit },
      },
      request: { method: "POST", url: "Observation" },
    });
  }

  if (input.notes) {
    entries.push({
      fullUrl: `urn:uuid:${randomUUID()}`,
      resource: {
        resourceType: "Observation",
        status: "final",
        code: { text: "Notes cliniques" },
        subject: { reference: patientRef },
        encounter: { reference: encounterFullUrl },
        effectiveDateTime: now,
        valueString: input.notes,
      },
      request: { method: "POST", url: "Observation" },
    });
  }

  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };
}

interface TransactionResponseBundle {
  entry?: { response?: { location?: string } }[];
}

export function parseEncounterTransactionResponse(bundle: TransactionResponseBundle): { encounterId: string } {
  const location = bundle.entry
    ?.map((entry) => entry.response?.location)
    .find((loc): loc is string => Boolean(loc?.startsWith("Encounter/")));

  const encounterId = location?.split("/")[1];
  if (!encounterId) {
    throw new Error("Réponse HAPI inattendue : identifiant de la consultation introuvable.");
  }

  return { encounterId };
}
