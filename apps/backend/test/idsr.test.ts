import { test } from "node:test";
import assert from "node:assert/strict";
import { PRIORITY_DISEASES, diseaseOf, isoWeekOf, parseIsoWeek, weeklySurveillance } from "../src/lib/idsr.js";
import { DIAGNOSES } from "../src/lib/diagnoses.js";

test("semaines ISO : lundi au dimanche, aller-retour, semaines inexistantes refusées", () => {
  const w = parseIsoWeek("2026-W43")!;
  assert.equal(w.start.toISOString(), "2026-10-19T00:00:00.000Z"); // lundi
  assert.equal(w.end.toISOString(), "2026-10-26T00:00:00.000Z");
  assert.equal(isoWeekOf(new Date("2026-10-25T23:59:00Z")), "2026-W43"); // dimanche
  assert.equal(isoWeekOf(new Date("2026-10-26T00:00:00Z")), "2026-W44");
  assert.equal(isoWeekOf(new Date("2027-01-01T12:00:00Z")), "2026-W53"); // fin d'année ISO
  assert.ok(parseIsoWeek("2026-W53")); // 2026 a 53 semaines
  assert.equal(parseIsoWeek("2025-W53"), null); // 2025 n'en a que 52
  assert.equal(parseIsoWeek("2026-43"), null);
  assert.equal(parseIsoWeek("2026-W00"), null);
});

test("une maladie est reconnue par préfixe CIM-10, avec ou sans point", () => {
  assert.equal(diseaseOf("B50.9")?.key, "malaria");
  assert.equal(diseaseOf("b54")?.key, "malaria");
  assert.equal(diseaseOf("A00.9")?.key, "cholera");
  assert.equal(diseaseOf("G00.9")?.key, "meningitis");
  assert.equal(diseaseOf("J06.9"), undefined); // infection respiratoire haute : non prioritaire
  assert.equal(diseaseOf(undefined), undefined);
});

test("les codes de la liste prioritaire qui sont au catalogue de diagnostics sont reconnus", () => {
  const known = ["A00.9", "A80.9", "A36.9", "A33", "A82.9", "A90", "A39.0", "A20.9", "A98.4", "A95.9", "B05.9", "B50.9"];
  for (const code of known) {
    assert.ok(DIAGNOSES.some((d) => d.code === code), `${code} absent du catalogue`);
    assert.ok(diseaseOf(code), `${code} non surveillé`);
  }
  assert.equal(new Set(PRIORITY_DISEASES.map((d) => d.key)).size, PRIORITY_DISEASES.length);
});

test("comptage hebdomadaire, moins de 5 ans, alerte immédiate et seuil comparé aux 4 semaines précédentes", () => {
  const week = parseIsoWeek("2026-W43")!;
  const inWeek = "2026-10-21T10:00:00Z";
  const prev = (n: number) => new Date(week.start.getTime() - n * 7 * 86_400_000 + 3_600_000).toISOString();
  const facts = [
    // 6 cas de paludisme cette semaine (dont 2 de moins de 5 ans, 1 confirmé)
    ...Array.from({ length: 6 }, (_, i) => ({
      icdCode: "B50.9",
      recordedAt: inWeek,
      confirmed: i === 0,
      birthDate: i < 2 ? "2023-01-01" : "2015-01-01",
      sex: "female",
    })),
    // 4 cas par semaine les 4 semaines précédentes => moyenne 1 par semaine
    ...[1, 2, 3, 4].map((n) => ({ icdCode: "B54", recordedAt: prev(n), confirmed: false })),
    // un cas de rougeole : alerte immédiate
    { icdCode: "B05.9", recordedAt: inWeek, confirmed: false, birthDate: "2024-05-01", sex: "male" },
    // hors fenêtre : ignoré
    { icdCode: "B50.9", recordedAt: "2026-10-26T00:00:00Z", confirmed: false },
    { icdCode: "J06.9", recordedAt: inWeek, confirmed: false },
  ];
  const { rows, immediateCases } = weeklySurveillance(facts, week);
  const malaria = rows.find((r) => r.key === "malaria")!;
  assert.deepEqual([malaria.cases, malaria.confirmed, malaria.underFive, malaria.previousAverage], [6, 1, 2, 1]);
  assert.equal(malaria.alert, "threshold"); // >= 5 cas et >= 2 x la moyenne
  const measles = rows.find((r) => r.key === "measles")!;
  assert.equal(measles.alert, "immediate");
  assert.equal(immediateCases.length, 1);
  assert.equal(immediateCases[0].ageMonths, 29); // né le 2024-05-01, vu le 2026-10-21
  assert.ok(!("patientId" in immediateCases[0]));
  assert.equal(rows.find((r) => r.key === "cholera")!.alert, null);
});
