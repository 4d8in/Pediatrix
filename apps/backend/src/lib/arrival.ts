import { hapiClient } from "./hapi-client.js";

// Une arrivée = un Encounter ambulatoire au statut « arrived », créé à l'accueil.
// La consultation du médecin le reprend et le clôt (statut « finished »).
export type EncounterResource = Record<string, unknown> & { id: string; period?: { start?: string } };

export function startOfTodayIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// Heure de saisie déclarée par un poste qui était hors ligne (voir lib/occurred-at.ts). La file du
// jour repose sur l'heure de réception du serveur (`period.start`) ; l'heure déclarée est gardée à part.
export const DECLARED_TIME_EXTENSION_URL = "http://pediatrix.local/fhir/declared-time";

export function toArrivedEncounter(patientId: string, declaredIso?: string) {
  return {
    resourceType: "Encounter",
    status: "arrived",
    class: { code: "AMB", display: "ambulatory" },
    subject: { reference: `Patient/${patientId}` },
    period: { start: new Date().toISOString() },
    extension: declaredIso ? [{ url: DECLARED_TIME_EXTENSION_URL, valueDateTime: declaredIso }] : undefined,
  };
}

// Arrivée du jour non encore consultée pour ce patient, s'il y en a une.
export async function findTodayArrival(patientId: string): Promise<EncounterResource | undefined> {
  const bundle = await hapiClient.get<{ entry?: { resource: EncounterResource }[] }>(
    `/Encounter?patient=${patientId}&class=AMB&status=arrived&date=ge${startOfTodayIso()}&_sort=-date&_count=1`,
    { "Cache-Control": "no-cache" },
  );
  return bundle.entry?.[0]?.resource;
}

export async function createArrival(patientId: string, declaredIso?: string): Promise<string> {
  const created = await hapiClient.post<{ id: string }>("/Encounter", toArrivedEncounter(patientId, declaredIso));
  return created.id;
}
