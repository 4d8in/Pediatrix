import { test } from "node:test";
import assert from "node:assert/strict";
import { fromFhirImmunizationBundle, toFhirImmunization } from "../src/modules/vaccination/immunization.fhir.js";
import { DEFAULT_SCHEDULE, VACCINES, computeSchedule } from "../src/lib/vaccines.js";

const today = new Date("2026-10-19T10:00:00Z");

test("le calendrier ne référence que des vaccins du catalogue, avec des doses consécutives", () => {
  const codes = new Set(VACCINES.map((v) => v.code));
  assert.ok(DEFAULT_SCHEDULE.every((e) => codes.has(e.vaccine)));
  for (const vaccine of codes) {
    const doses = DEFAULT_SCHEDULE.filter((e) => e.vaccine === vaccine).map((e) => e.dose).sort();
    assert.deepEqual(doses, doses.map((_, i) => i + 1), `doses de ${vaccine}`);
  }
});

test("un nourrisson de 5 mois : naissance faite, 6 semaines faites, 10 semaines en retard, 9 mois à venir", () => {
  // Né le 2026-05-19 : 6 semaines = 06-30, 10 semaines = 07-28, 14 semaines = 08-25, 9 mois = ~02-2027
  const items = computeSchedule(
    "2026-05-19",
    [
      { code: "BCG", date: "2026-05-20" },
      { code: "VPO", date: "2026-05-20" },
      { code: "PENTA", date: "2026-07-01" },
      { code: "VPO", date: "2026-07-01" },
    ],
    DEFAULT_SCHEDULE,
    today,
  );
  const find = (vaccine: string, dose: number) => items.find((i) => i.vaccine === vaccine && i.dose === dose)!;

  assert.equal(find("BCG", 1).status, "done");
  assert.equal(find("BCG", 1).doneDate, "2026-05-20");
  assert.equal(find("PENTA", 1).status, "done");
  assert.equal(find("PENTA", 2).status, "overdue"); // prévue le 2026-07-28, > 28 jours de retard
  assert.equal(find("PENTA", 3).status, "overdue"); // prévue le 2026-08-25, retard de 55 jours
  assert.equal(find("RR", 1).status, "upcoming");
  assert.equal(find("PENTA", 2).dueDate, "2026-07-28");
});

test("une dose juste échue est « à faire », pas encore « en retard »", () => {
  // Né le 2026-09-07 : 6 semaines = 2026-10-19 (aujourd'hui) -> à faire
  const items = computeSchedule("2026-09-07", [], DEFAULT_SCHEDULE, today);
  assert.equal(items.find((i) => i.vaccine === "PENTA" && i.dose === 1)!.status, "due");
  assert.equal(items.find((i) => i.vaccine === "PENTA" && i.dose === 2)!.status, "upcoming");
});

test("les doses faites comblent les premières doses, même sans numéro de dose saisi", () => {
  const items = computeSchedule(
    "2025-01-01",
    [
      { code: "PENTA", date: "2025-02-15" },
      { code: "PENTA", date: "2025-03-15" },
      { code: "PENTA", date: "2025-04-15" },
    ],
    DEFAULT_SCHEDULE,
    today,
  );
  const penta = items.filter((i) => i.vaccine === "PENTA");
  assert.ok(penta.every((i) => i.status === "done"));
  assert.deepEqual(penta.map((i) => i.doneDate), ["2025-02-15", "2025-03-15", "2025-04-15"]);
});

test("une date de naissance invalide ne produit aucun calendrier", () => {
  assert.deepEqual(computeSchedule("", [], DEFAULT_SCHEDULE, today), []);
});

test("un vaccin du catalogue est codé dans l'Immunization et relu ; un texte libre reste sans code", () => {
  const coded = toFhirImmunization("p1", { vaccine: "Pentavalent (DTC-HepB-Hib)", vaccineCode: "PENTA", date: "2026-07-01", doseNumber: 1 });
  assert.equal(coded.vaccineCode.coding?.[0].code, "PENTA");
  const summary = fromFhirImmunizationBundle({ entry: [{ resource: { ...coded, id: "i1" } as never }] })[0];
  assert.equal(summary.vaccineCode, "PENTA");

  const free = toFhirImmunization("p1", { vaccine: "Vaccin local", date: "2026-07-01" });
  assert.equal(free.vaccineCode.coding, undefined);
});
