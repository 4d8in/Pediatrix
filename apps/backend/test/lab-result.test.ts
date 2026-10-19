import { test } from "node:test";
import assert from "node:assert/strict";
import { LAB_CATALOG, findCatalogEntry } from "../src/lib/lab-catalog.js";
import { interpretValue, parseNumericValue, toResultObservation } from "../src/modules/laboratoire/report.fhir.js";

const NOW = "2026-10-19T08:00:00.000Z";

test("parseNumericValue lit un nombre, y compris à virgule, et refuse le reste", () => {
  assert.equal(parseNumericValue("8.2"), 8.2);
  assert.equal(parseNumericValue(" 8,2 "), 8.2);
  assert.equal(parseNumericValue("8.2 g/dL"), undefined);
  assert.equal(parseNumericValue("Positif"), undefined);
});

test("interpretValue ne juge pas sans plage de référence", () => {
  assert.equal(interpretValue(8, undefined, undefined), undefined);
  assert.equal(interpretValue(8, 11, 14), "L");
  assert.equal(interpretValue(15, 11, 14), "H");
  assert.equal(interpretValue(12, 11, 14), "N");
  assert.equal(interpretValue(11, 11, 14), "N");
});

test("une analyse du catalogue devient une Observation LOINC quantifiée, avec plage et drapeau", () => {
  const obs = toResultObservation(
    { label: "Hémoglobine", value: "8.2", code: "718-7", referenceLow: 11, referenceHigh: 14 },
    "Patient/p1",
    "Encounter/e1",
    NOW,
  );
  assert.deepEqual(obs.code.coding, [{ system: "http://loinc.org", code: "718-7", display: "Hémoglobine" }]);
  // L'unité vient du catalogue quand le technicien ne la saisit pas.
  assert.equal(obs.valueQuantity?.value, 8.2);
  assert.equal(obs.valueQuantity?.unit, "g/dL");
  assert.equal(obs.referenceRange?.[0].low?.value, 11);
  assert.equal(obs.interpretation?.[0].coding[0].code, "L");
  assert.equal("valueString" in obs, false);
});

test("sans plage de référence, aucune interprétation n'est posée", () => {
  const obs = toResultObservation({ label: "Glycémie", value: "90", code: "2345-7" }, undefined, undefined, NOW);
  assert.equal(obs.valueQuantity?.value, 90);
  assert.equal(obs.referenceRange, undefined);
  assert.equal(obs.interpretation, undefined);
});

test("un résultat texte reste en valueString (compatibilité avec la saisie libre)", () => {
  const texte = toResultObservation({ label: "Hémoglobine", value: "8.2 g/dL" }, "Patient/p1", undefined, NOW);
  assert.equal(texte.valueString, "8.2 g/dL");
  assert.equal(texte.code.coding, undefined);

  const qualitatif = toResultObservation({ label: "Goutte épaisse", value: "Positif" }, undefined, undefined, NOW);
  assert.equal(qualitatif.valueString, "Positif");
});

test("un code absent du catalogue ne produit pas de codage LOINC", () => {
  const obs = toResultObservation({ label: "Inconnu", value: "1", code: "0000-0" }, undefined, undefined, NOW);
  assert.equal(obs.code.coding, undefined);
});

test("le catalogue est cohérent : codes uniques, panels composés d'analyses existantes", () => {
  const codes = LAB_CATALOG.map((entry) => entry.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const entry of LAB_CATALOG) {
    for (const analyte of entry.panel ?? []) {
      assert.ok(findCatalogEntry(analyte), `analyse ${analyte} du panel ${entry.display} introuvable`);
    }
  }
});
