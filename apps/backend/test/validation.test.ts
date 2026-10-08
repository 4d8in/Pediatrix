import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAUSIBLE_RANGES, checkPastDate, checkRange } from "../src/lib/validation.js";

test("checkPastDate accepte une date passée au bon format", () => {
  assert.equal(checkPastDate("2024-05-12", "La date"), null);
});

test("checkPastDate refuse un format invalide et une date future", () => {
  assert.match(checkPastDate("12/05/2024", "La date") ?? "", /AAAA-MM-JJ/);
  assert.match(checkPastDate("2999-01-01", "La date") ?? "", /futur/);
});

test("checkRange accepte une fièvre, refuse une faute de frappe", () => {
  assert.equal(checkRange(39.8, PLAUSIBLE_RANGES.temperature, "Température"), null);
  assert.match(checkRange(385, PLAUSIBLE_RANGES.temperature, "Température") ?? "", /entre 30 et 45/);
});

test("checkRange refuse une valeur non numérique", () => {
  assert.notEqual(checkRange(Number.NaN, PLAUSIBLE_RANGES.weight, "Poids"), null);
});
