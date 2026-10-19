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

import { doseSchedule } from "../src/lib/administration-schedule.js";
import { isDeceased } from "../src/lib/deceased.js";
import { validateDischarge, withDischarge, withoutDeath, readDischarge } from "../src/lib/discharge.js";

test("échéancier : prise due, en retard, ou pas encore due", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  // 3 prises/jour = toutes les 8 h ; dernière prise à 06h -> prochaine à 14h
  assert.equal(doseSchedule({ dosesPerDay: 3, lastGivenAt: "2026-10-19T06:00:00Z", anchor: "2026-10-18T00:00:00Z", now })?.state, "not_due");
  assert.equal(doseSchedule({ dosesPerDay: 3, lastGivenAt: "2026-10-19T04:00:00Z", anchor: "2026-10-18T00:00:00Z", now })?.state, "due");
  assert.equal(doseSchedule({ dosesPerDay: 3, lastGivenAt: "2026-10-19T00:00:00Z", anchor: "2026-10-18T00:00:00Z", now })?.state, "overdue");
  // jamais donné : due dès l'ordonnance
  assert.equal(doseSchedule({ dosesPerDay: 2, lastGivenAt: null, anchor: "2026-10-19T11:50:00Z", now })?.state, "due");
  assert.equal(doseSchedule({ dosesPerDay: 0, lastGivenAt: null, anchor: "2026-10-19T11:50:00Z", now }), null);
});

test("décès : date réelle validée, helper, correction tracée", () => {
  assert.equal(isDeceased({}), false);
  assert.equal(isDeceased({ deceasedBoolean: true }), true);
  assert.equal(isDeceased({ deceasedDateTime: "2026-10-19T00:00:00Z" }), true);
  const ok = validateDischarge({ outcome: "deceased", deceasedAt: "2026-10-18T22:30:00Z" });
  assert.deepEqual(ok, { outcome: "deceased", summary: undefined, deceasedAt: "2026-10-18T22:30:00.000Z" });
  assert.ok("errors" in validateDischarge({ outcome: "deceased", deceasedAt: "2999-01-01T00:00:00Z" }));
  assert.ok("errors" in validateDischarge({ outcome: "healed", deceasedAt: "2026-10-18T22:30:00Z" }));
  assert.ok("errors" in validateDischarge({ outcome: "deceased", deceasedAt: "n'importe quoi" }));
  const stay = withDischarge({ resourceType: "Encounter", id: "1" }, "deceased", "x");
  const fixed = withoutDeath(stay, "erreur de saisie");
  assert.equal(readDischarge(fixed as never).outcome, null);
  assert.equal((fixed.hospitalization as unknown), undefined);
  assert.ok(JSON.stringify(fixed).includes("erreur de saisie"));
});

test("échéancier : bornes (exactement au délai de grâce, 1 et 24 prises par jour)", () => {
  const anchor = "2026-10-19T00:00:00Z";
  // 1 prise/jour, dernière à 00h : due à 24h, grâce = max(30 min, 6 h) = 6 h
  assert.equal(doseSchedule({ dosesPerDay: 1, lastGivenAt: anchor, anchor, now: new Date("2026-10-20T05:59:00Z") })?.state, "due");
  assert.equal(doseSchedule({ dosesPerDay: 1, lastGivenAt: anchor, anchor, now: new Date("2026-10-20T06:00:00Z") })?.state, "overdue");
  assert.ok(doseSchedule({ dosesPerDay: 24, lastGivenAt: anchor, anchor, now: new Date("2026-10-19T00:30:00Z") }));
  assert.equal(doseSchedule({ dosesPerDay: 25, lastGivenAt: null, anchor }), null);
});

test("décès : la date doit être un ISO complet avec fuseau", () => {
  assert.ok("errors" in validateDischarge({ outcome: "deceased", deceasedAt: "2026-10-19" }));
  assert.ok("errors" in validateDischarge({ outcome: "deceased", deceasedAt: "2026-10-19T10:00" }));
  assert.ok("deceasedAt" in (validateDischarge({ outcome: "deceased", deceasedAt: "2026-10-19T10:00:00+01:00" }) as object));
});

test("échéancier : cure terminée", () => {
  const anchor = "2026-10-10T00:00:00Z";
  const endAt = "2026-10-13T00:00:00Z";
  assert.equal(doseSchedule({ dosesPerDay: 3, lastGivenAt: null, anchor, endAt, now: new Date("2026-10-14T00:00:00Z") })?.state, "finished");
  assert.equal(doseSchedule({ dosesPerDay: 3, lastGivenAt: null, anchor, endAt, now: new Date("2026-10-12T23:00:00Z") })?.state, "overdue");
});
