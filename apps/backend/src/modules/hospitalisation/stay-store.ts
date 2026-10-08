import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import type { BedStatus, FhirLocation, FhirStay } from "./beds.fhir.js";
import { withBedStatus } from "./beds.fhir.js";

// Accès HAPI partagés par les routes du module Hospitalisation.

export async function getBed(bedId: string): Promise<FhirLocation | null> {
  try {
    return await hapiClient.get<FhirLocation>(`/Location/${encodeURIComponent(bedId)}`);
  } catch (error) {
    if (error instanceof HapiError && error.statusCode === 404) return null;
    throw error;
  }
}

export async function getStay(stayId: string): Promise<FhirStay | null> {
  try {
    const stay = await hapiClient.get<FhirStay>(`/Encounter/${encodeURIComponent(stayId)}`);
    return stay.status === "in-progress" ? stay : null;
  } catch (error) {
    if (error instanceof HapiError && error.statusCode === 404) return null;
    throw error;
  }
}

// Envoie un Bundle transaction : toutes les écritures réussissent ou aucune.
export async function runTransaction(entries: unknown[]): Promise<void> {
  await hapiClient.post("", { resourceType: "Bundle", type: "transaction", entry: entries });
}

export function putBedEntry(bed: FhirLocation, status: BedStatus) {
  return { resource: withBedStatus(bed, status), request: { method: "PUT", url: `Location/${bed.id}` } };
}

export function putStayEntry(stay: FhirStay) {
  return { resource: stay, request: { method: "PUT", url: `Encounter/${stay.id}` } };
}

export function hapiErrorReply(error: unknown): { code: number; error: string } | null {
  if (error instanceof HapiError) {
    return { code: error.statusCode >= 500 ? 502 : error.statusCode, error: error.message };
  }
  return null;
}
