import { test } from "node:test";
import assert from "node:assert/strict";
import { referenceFor } from "../src/lib/lab-reference-ranges.js";
import { interpretValue } from "../src/modules/laboratoire/report.fhir.js";

test("la référence de l'hémoglobine dépend de l'âge et du sexe", () => {
  assert.equal(referenceFor("718-7", 3, "male")?.low, 9.5);
  assert.equal(referenceFor("718-7", 14 * 12, "female")?.low, 12);
  assert.equal(referenceFor("718-7", 14 * 12, "male")?.low, 13);
});

test("sans âge connu ou pour une analyse hors table, aucune référence", () => {
  assert.equal(referenceFor("718-7", null, "male"), undefined);
  assert.equal(referenceFor("0000-0", 12, "male"), undefined);
});

test("les valeurs critiques priment sur les simples anomalies", () => {
  assert.equal(interpretValue(6, 9.5, 13.5, 7, undefined), "LL");
  assert.equal(interpretValue(8, 9.5, 13.5, 7, undefined), "L");
  assert.equal(interpretValue(11, 9.5, 13.5, 7, undefined), "N");
  assert.equal(interpretValue(60, 4.5, 11, 2, 50), "HH");
});

test("sexe non renseigné : une plage et un seuil critique d'hémoglobine restent proposés", () => {
  const ref = referenceFor("718-7", 14 * 12, "unknown");
  assert.equal(ref?.criticalLow, 7);
});

test("le nouveau-né a une plage de glycémie propre", () => {
  assert.equal(referenceFor("2345-7", 0, "male")?.low, 45);
  assert.equal(referenceFor("2345-7", 6, "male")?.low, 70);
});
