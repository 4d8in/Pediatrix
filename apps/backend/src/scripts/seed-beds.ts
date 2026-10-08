import "dotenv/config";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import { BED_STATUS_SYSTEM } from "../modules/hospitalisation/beds.fhir.js";

// Crée (une seule fois) les services et leurs lits dans HAPI, sous forme de
// ressources Location à id déterministe. Ré-exécutable : un lit déjà présent
// n'est pas modifié (son état — libre, occupé… — est conservé).
const WARDS = [
  { id: "ward-pediatrie", name: "Pédiatrie générale", prefix: "PED", beds: 8 },
  { id: "ward-neonatologie", name: "Néonatologie", prefix: "NEO", beds: 6 },
  { id: "ward-urgences", name: "Urgences pédiatriques", prefix: "URG", beds: 4 },
  { id: "ward-isolement", name: "Isolement", prefix: "ISO", beds: 2 },
];

async function exists(id: string): Promise<boolean> {
  try {
    await hapiClient.get(`/Location/${id}`);
    return true;
  } catch (error) {
    if (error instanceof HapiError && error.statusCode === 404) return false;
    throw error;
  }
}

async function main() {
  let created = 0;
  for (const ward of WARDS) {
    if (!(await exists(ward.id))) {
      await hapiClient.put(`/Location/${ward.id}`, {
        resourceType: "Location",
        id: ward.id,
        status: "active",
        name: ward.name,
        physicalType: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/location-physical-type", code: "wa" }] },
      });
      created += 1;
    }

    for (let n = 1; n <= ward.beds; n += 1) {
      const number = String(n).padStart(2, "0");
      const id = `bed-${ward.prefix.toLowerCase()}-${number}`;
      if (await exists(id)) continue;
      await hapiClient.put(`/Location/${id}`, {
        resourceType: "Location",
        id,
        status: "active",
        name: `${ward.prefix}-${number}`,
        operationalStatus: { system: BED_STATUS_SYSTEM, code: "U", display: "Libre" },
        physicalType: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/location-physical-type", code: "bd" }] },
        partOf: { reference: `Location/${ward.id}` },
      });
      created += 1;
    }
  }
  console.log(`Services et lits : ${created} ressource(s) créée(s), les autres existaient déjà.`);
}

main().catch((error) => {
  console.error("ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
