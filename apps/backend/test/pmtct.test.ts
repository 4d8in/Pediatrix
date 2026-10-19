import { test } from "node:test";
import assert from "node:assert/strict";
import { followUp, milestoneTooEarly, validateEnrolment, validateTest } from "../src/lib/pmtct.js";
import { fromPmtctBundle, toEnrolmentBundle, toTestObservation } from "../src/modules/ptme/pmtct.fhir.js";

test("PTME : validation", () => {
  assert.ok("errors" in validateEnrolment({}));
  assert.ok("errors" in validateEnrolment({ motherStatus: "x", infantProphylaxis: true }));
  assert.ok("input" in validateEnrolment({ motherStatus: "on_art", infantProphylaxis: false }));
  assert.ok("errors" in validateTest({ milestone: "pcr_6w", result: "peut-être" }));
  assert.ok("errors" in validateTest({ milestone: "autre", result: "negative" }));
  assert.ok("input" in validateTest({ milestone: "sero_18m", result: "positive" }));
});

test("PTME : jalons à venir, dus, en retard, faits", () => {
  const birth = "2026-01-01";
  // 6 semaines = 42 jours -> 2026-02-12 ; en retard après 28 jours -> 2026-03-12
  assert.equal(followUp(birth, [], new Date("2026-02-01T00:00:00Z")).milestones[0].state, "upcoming");
  assert.equal(followUp(birth, [], new Date("2026-02-20T00:00:00Z")).milestones[0].state, "due");
  assert.equal(followUp(birth, [], new Date("2026-03-20T00:00:00Z")).milestones[0].state, "overdue");
  const done = followUp(birth, [{ milestone: "pcr_6w", result: "negative", date: "2026-02-13" }], new Date("2026-03-20T00:00:00Z"));
  assert.equal(done.milestones[0].state, "done");
  assert.equal(done.milestones[0].dueDate, "2026-02-12");
  assert.equal(done.status, "in_follow_up");
});

test("PTME : un résultat positif prime ; sérologie finale négative = sorti de suivi", () => {
  assert.equal(followUp("2026-01-01", [{ milestone: "pcr_6w", result: "positive", date: "x" }]).status, "positive");
  assert.equal(followUp("2025-01-01", [{ milestone: "sero_18m", result: "negative", date: "x" }]).status, "in_follow_up");
  assert.equal(
    followUp("2025-01-01", [{ milestone: "pcr_6w", result: "negative", date: "x" }, { milestone: "sero_18m", result: "negative", date: "x" }]).status,
    "cleared",
  );
});

test("PTME : aller-retour FHIR", () => {
  const enrol = toEnrolmentBundle("p1", { motherStatus: "not_on_art", infantProphylaxis: true }, "2026-02-01T00:00:00Z", "Inf. Test");
  const entries = (enrol.entry as unknown as { resource: never }[]).map((e) => ({ resource: e.resource }));
  entries.push({ resource: toTestObservation("p1", "pcr_6w", "negative", "2026-02-13T00:00:00Z", "Inf. Test") as never });
  const back = fromPmtctBundle({ entry: entries });
  assert.deepEqual(back.enrolment, { motherStatus: "not_on_art", infantProphylaxis: true });
  assert.equal(back.results.length, 1);
  assert.equal(back.results[0].milestone, "pcr_6w");
});

test("PTME : résultat trop tôt ou naissance invalide refusés", () => {
  const now = new Date("2026-10-19T00:00:00Z");
  assert.ok(milestoneTooEarly("2026-10-15", "pcr_6w", now));
  assert.equal(milestoneTooEarly("2026-09-01", "pcr_6w", now), null);
  assert.ok(milestoneTooEarly("2026-09-01", "sero_18m", now));
  assert.ok(milestoneTooEarly("", "pcr_6w", now));
  assert.ok(milestoneTooEarly("2026", "pcr_6w", now));
});
