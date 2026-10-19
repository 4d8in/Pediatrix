import { test } from "node:test";
import assert from "node:assert/strict";
import { TRIAGE_SYSTEM, latestTriageByEncounter, toTriageObservation, triageRank } from "../src/lib/triage.js";
import { toEncounterTransactionBundle } from "../src/modules/pediatrie/encounter.fhir.js";
import { buildQueue } from "../src/routes/active-queue.route.js";
import { toArrivedEncounter } from "../src/lib/arrival.js";

const patient = (id: string, given: string) => ({ resourceType: "Patient", id, name: [{ given: [given], family: "Test" }], birthDate: "2021-01-01", gender: "female" });
const encounter = (id: string, patientId: string, status: string, start: string) => ({
  resourceType: "Encounter",
  id,
  status,
  subject: { reference: `Patient/${patientId}` },
  period: { start },
});
const triageObs = (encounterId: string, code: string, at: string) => ({
  id: `t-${encounterId}-${at}`,
  encounter: { reference: `Encounter/${encounterId}` },
  effectiveDateTime: at,
  valueCodeableConcept: { coding: [{ system: TRIAGE_SYSTEM, code }] },
});

test("la file passe les urgences d'abord, puis les prioritaires, les non triés, les non urgents", () => {
  const queue = buildQueue(
    [
      encounter("e1", "p1", "arrived", "2026-10-19T08:00:00Z"),
      encounter("e2", "p2", "arrived", "2026-10-19T08:10:00Z"),
      encounter("e3", "p3", "arrived", "2026-10-19T08:20:00Z"),
      encounter("e4", "p4", "arrived", "2026-10-19T08:30:00Z"),
      encounter("e5", "p5", "finished", "2026-10-19T07:00:00Z"),
    ],
    ["p1", "p2", "p3", "p4", "p5"].map((id, i) => patient(id, `P${i + 1}`)) as never,
    [],
    [triageObs("e1", "non_urgent", "2026-10-19T08:01:00Z"), triageObs("e3", "emergency", "2026-10-19T08:21:00Z"), triageObs("e4", "priority", "2026-10-19T08:31:00Z")] as never,
  );
  assert.deepEqual(queue.map((q) => q.patientId), ["p3", "p4", "p2", "p1", "p5"]); // urgence, prioritaire, non trié, non urgent, puis consulté
  assert.equal(queue[0].triage, "emergency");
  assert.equal(queue[2].triage, null);
  assert.equal(queue.at(-1)?.status, "consulte");
});

test("un patient connu qui revient figure dans la file sans avoir été créé aujourd'hui", () => {
  const queue = buildQueue([encounter("e9", "old", "arrived", "2026-10-19T09:00:00Z")], [patient("old", "Ancien")] as never, [], []);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].name, "Ancien Test");
  assert.equal(queue[0].status, "en_attente");
});

test("l'arrivée en attente prime sur une consultation plus ancienne du même patient", () => {
  const queue = buildQueue(
    [encounter("done", "p1", "finished", "2026-10-19T07:00:00Z"), encounter("again", "p1", "arrived", "2026-10-19T10:00:00Z")],
    [patient("p1", "Awa")] as never,
    [],
    [],
  );
  assert.equal(queue.length, 1);
  assert.equal(queue[0].encounterId, "again");
  assert.equal(queue[0].status, "en_attente");
});

test("un patient créé aujourd'hui sans Encounter (ancien flux) reste « en attente »", () => {
  const legacy = { ...patient("l1", "Legacy"), meta: { lastUpdated: "2026-10-19T06:00:00Z" } };
  const queue = buildQueue([], [], [legacy] as never, []);
  assert.deepEqual([queue[0].patientId, queue[0].status, queue[0].encounterId], ["l1", "en_attente", null]);
});

test("le dernier tri d'une arrivée l'emporte", () => {
  const latest = latestTriageByEncounter([
    triageObs("e1", "priority", "2026-10-19T08:00:00Z"),
    triageObs("e1", "emergency", "2026-10-19T08:30:00Z"),
  ] as never);
  assert.equal(latest.get("e1"), "emergency");
  assert.equal(triageRank("emergency") < triageRank("priority"), true);
  assert.equal(triageRank(null) < triageRank("non_urgent"), true);
});

test("l'observation de tri est codée et rattachée à l'arrivée et à l'infirmière", () => {
  const obs = toTriageObservation("p1", "e1", "priority", "Toux persistante", { id: "n1", name: "Fatou" });
  assert.equal(obs.valueCodeableConcept.coding[0].code, "priority");
  assert.equal(obs.encounter.reference, "Encounter/e1");
  assert.equal(obs.performer[0].reference, "Practitioner/n1");
});

test("la consultation reprend l'arrivée du jour (PUT) et garde son heure d'arrivée ; sinon elle crée un Encounter", () => {
  const arrival = { ...toArrivedEncounter("p1"), id: "arr1", period: { start: "2026-10-19T08:00:00.000Z" } };
  const reused = toEncounterTransactionBundle("p1", { reason: "Fièvre", vitals: { temperature: 38 } }, { id: "d1", name: "Dr" }, arrival as never);
  const first = reused.entry[0] as { request: { method: string; url: string }; resource: { status: string; period: { start: string } } };
  assert.deepEqual(first.request, { method: "PUT", url: "Encounter/arr1" });
  assert.equal(first.resource.status, "finished");
  assert.equal(first.resource.period.start, "2026-10-19T08:00:00.000Z");
  const obs = reused.entry[1] as { resource: { encounter: { reference: string } } };
  assert.equal(obs.resource.encounter.reference, "Encounter/arr1");

  const fresh = toEncounterTransactionBundle("p1", { reason: "Fièvre", vitals: {} }, undefined, undefined);
  assert.equal((fresh.entry[0] as { request: { method: string } }).request.method, "POST");
});
