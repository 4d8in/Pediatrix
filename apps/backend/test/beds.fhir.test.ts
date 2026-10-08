import { test } from "node:test";
import assert from "node:assert/strict";
import { bedStatusOf, currentBedId, withBedStatus } from "../src/modules/hospitalisation/beds.fhir.js";
import type { FhirLocation, FhirStay } from "../src/modules/hospitalisation/beds.fhir.js";

const bed: FhirLocation = { resourceType: "Location", id: "bed-ped-01", name: "PED-01" };

test("un lit sans état explicite est considéré libre", () => {
  assert.equal(bedStatusOf(bed), "U");
});

test("withBedStatus change l'état sans perdre le reste de la ressource", () => {
  const occupied = withBedStatus(bed, "O");
  assert.equal(bedStatusOf(occupied), "O");
  assert.equal(occupied.name, "PED-01");
  assert.equal(bedStatusOf(bed), "U", "la ressource d'origine n'est pas modifiée");
});

test("currentBedId renvoie le lit actif du séjour, pas l'ancien lit après transfert", () => {
  const stay: FhirStay = {
    resourceType: "Encounter",
    id: "s1",
    location: [
      { location: { reference: "Location/bed-ped-01" }, status: "completed" },
      { location: { reference: "Location/bed-iso-02" }, status: "active" },
    ],
  };
  assert.equal(currentBedId(stay), "bed-iso-02");
});

test("currentBedId renvoie null pour un séjour terminé", () => {
  const stay: FhirStay = {
    resourceType: "Encounter",
    id: "s2",
    location: [{ location: { reference: "Location/bed-ped-01" }, status: "completed" }],
  };
  assert.equal(currentBedId(stay), null);
});
