import { test } from "node:test";
import assert from "node:assert/strict";
import { findMatchingAllergy } from "../src/modules/prescription/allergy.fhir.js";

const allergies = [
  { resourceType: "AllergyIntolerance", id: "a1", code: { text: "Amoxicilline" } },
  { resourceType: "AllergyIntolerance", id: "a2", code: { text: "Arachide" } },
] as Parameters<typeof findMatchingAllergy>[0];

test("findMatchingAllergy détecte une allergie connue, sans tenir compte de la casse", () => {
  assert.equal(findMatchingAllergy(allergies, "AMOXICILLINE 500 mg")?.id, "a1");
});

test("findMatchingAllergy ne signale rien pour un médicament sans allergie", () => {
  assert.equal(findMatchingAllergy(allergies, "Paracétamol"), undefined);
});
