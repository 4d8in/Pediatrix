import { test } from "node:test";
import assert from "node:assert/strict";
import { birthAlerts, validateBirth } from "../src/lib/birth.js";
import { fromBirthBundle, toBirthBundle } from "../src/modules/naissance/birth.fhir.js";
import { fromFhirAdministrations, toFhirAdministration } from "../src/modules/hospitalisation/administration.fhir.js";

test("naissance : validation des bornes", () => {
  assert.ok("errors" in validateBirth({}));
  assert.ok("errors" in validateBirth({ birthWeightG: 100 }));
  assert.ok("errors" in validateBirth({ birthWeightG: 3200, apgar5: 11 }));
  assert.ok("errors" in validateBirth({ birthWeightG: 3200, deliveryMode: "x" }));
  assert.ok("errors" in validateBirth({ birthWeightG: 3200.5 }));
  const ok = validateBirth({ birthWeightG: 3200, apgar1: 8, apgar5: 9, gestationalAgeWeeks: 39, deliveryMode: "vaginal" });
  assert.ok("input" in ok);
});

test("naissance : alertes poids, prématurité, Apgar", () => {
  assert.deepEqual(birthAlerts({ birthWeightG: 3200, apgar5: 9, gestationalAgeWeeks: 40 }), []);
  assert.deepEqual(birthAlerts({ birthWeightG: 2400 }), ["low_birth_weight"]);
  assert.deepEqual(birthAlerts({ birthWeightG: 1200, gestationalAgeWeeks: 30, apgar5: 5 }), [
    "very_low_birth_weight",
    "preterm",
    "low_apgar",
  ]);
});

test("naissance : aller-retour FHIR", () => {
  const input = { birthWeightG: 2300, apgar1: 6, apgar5: 8, gestationalAgeWeeks: 36, deliveryMode: "caesarean" as const };
  const bundle = toBirthBundle("p1", input, "2026-10-19T08:00:00Z");
  assert.equal(bundle.entry.length, 5);
  const back = fromBirthBundle({ entry: (bundle.entry as { resource: never }[]).map((e) => ({ resource: e.resource })) });
  assert.equal(back?.birthWeightG, 2300);
  assert.equal(back?.deliveryMode, "caesarean");
  assert.deepEqual(back?.alerts, ["low_birth_weight", "preterm"]);
  assert.equal(fromBirthBundle({ entry: [] }), null);
});

test("administration : donné / non donné", () => {
  const base = { patientId: "p1", stayId: "s1", prescriptionId: "r1", medication: "Paracétamol", performer: { id: "u1", name: "Inf. Test" }, at: "2026-10-19T08:00:00Z" };
  const given = toFhirAdministration({ ...base, given: true });
  const notGiven = toFhirAdministration({ ...base, given: false, note: "Enfant vomit" });
  assert.equal(given.status, "completed");
  assert.equal(notGiven.status, "not-done");
  const list = fromFhirAdministrations({
    entry: [
      { resource: { ...given, id: "a1", effectiveDateTime: "2026-10-19T08:00:00Z" } },
      { resource: { ...notGiven, id: "a2", effectiveDateTime: "2026-10-19T12:00:00Z" } },
    ],
  });
  assert.equal(list[0].id, "a2");
  assert.equal(list[0].given, false);
  assert.equal(list[0].note, "Enfant vomit");
  assert.equal(list[1].by, "Inf. Test");
});
