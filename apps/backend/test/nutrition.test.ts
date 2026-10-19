import { test } from "node:test";
import assert from "node:assert/strict";
import { ageInMonths, classifyMuac } from "../src/lib/nutrition.js";

test("l'âge en mois se calcule à la date de la mesure", () => {
  assert.equal(ageInMonths("2025-01-15", "2026-01-14"), 11);
  assert.equal(ageInMonths("2025-01-15", "2026-01-15"), 12);
  assert.equal(ageInMonths("2026-06-01", "2026-01-01"), null); // naissance après la mesure
  assert.equal(ageInMonths("n'importe quoi", "2026-01-01"), null);
});

test("le PB classe l'enfant de 6 à 59 mois : sévère < 115, modérée 115-124, normal ≥ 125 (mm)", () => {
  const birth = "2025-01-01"; // 17 mois le 2026-06-15
  const day = "2026-06-15";
  assert.equal(classifyMuac(110, birth, day), "severe");
  assert.equal(classifyMuac(114, birth, day), "severe");
  assert.equal(classifyMuac(115, birth, day), "moderate");
  assert.equal(classifyMuac(124, birth, day), "moderate");
  assert.equal(classifyMuac(125, birth, day), "normal");
  assert.equal(classifyMuac(160, birth, day), "normal");
});

test("hors de 6 à 59 mois, aucun classement n'est posé", () => {
  assert.equal(classifyMuac(100, "2026-03-01", "2026-06-15"), null); // 3 mois
  assert.equal(classifyMuac(100, "2026-01-01", "2026-06-15"), null); // 5 mois
  assert.equal(classifyMuac(100, "2026-01-01", "2026-07-01"), "severe"); // 6 mois pile
  assert.equal(classifyMuac(100, "2021-01-01", "2026-06-15"), null); // 65 mois
});
