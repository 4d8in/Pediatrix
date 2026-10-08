import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHospitalisationStats } from "../src/lib/hospitalisation-stats.js";

// HAPI est simulé en remplaçant fetch : on vérifie uniquement le calcul.
const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-09-01T08:00:00Z");

function bundle(resources: unknown[]) {
  return { resourceType: "Bundle", entry: resources.map((resource) => ({ resource })) };
}

const locations = bundle([
  { id: "ward-a", name: "Pédiatrie", physicalType: { coding: [{ code: "wa" }] } },
  { id: "b1", partOf: { reference: "Location/ward-a" }, physicalType: { coding: [{ code: "bd" }] }, operationalStatus: { code: "O" } },
  { id: "b2", partOf: { reference: "Location/ward-a" }, physicalType: { coding: [{ code: "bd" }] }, operationalStatus: { code: "U" } },
  { id: "b3", partOf: { reference: "Location/ward-a" }, physicalType: { coding: [{ code: "bd" }] }, operationalStatus: { code: "H" } },
]);

const stays = bundle([
  { status: "in-progress", period: { start: start.toISOString() } },
  { status: "finished", period: { start: start.toISOString(), end: new Date(start.getTime() + 2 * DAY).toISOString() } },
  { status: "finished", period: { start: start.toISOString(), end: new Date(start.getTime() + 4 * DAY).toISOString() } },
]);

test("computeHospitalisationStats calcule occupation, séjours et durée moyenne", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const body = String(url).includes("/Location") ? locations : stays;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/fhir+json" } });
  });

  const stats = await computeHospitalisationStats();

  assert.equal(stats.litsTotal, 3);
  assert.equal(stats.litsOccupes, 1);
  assert.equal(stats.sejoursEnCours, 1);
  assert.equal(stats.sejoursTotal, 3);
  assert.equal(stats.dureeMoyenneJours, 3, "moyenne de 2 j et 4 j");
  assert.deepEqual(stats.parService, [{ service: "Pédiatrie", total: 3, occupes: 1 }]);
});
