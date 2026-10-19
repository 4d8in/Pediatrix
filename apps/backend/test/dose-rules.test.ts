import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDailyDose } from "../src/lib/dose-rules.js";
import { toFhirMedicationRequest } from "../src/modules/prescription/prescription.fhir.js";

test("une dose dans la limite par kg ne déclenche pas d'alerte", () => {
  assert.equal(checkDailyDose("PARA-SIR", 150, 4, 10), null); // 60 mg/kg/j
});

test("une dose au-dessus du maximum par kg déclenche une alerte", () => {
  const check = checkDailyDose("PARA-SIR", 500, 4, 10); // 200 mg/kg/j
  assert.ok(check?.message.includes("200"));
});

test("sans poids connu, la dose ne peut pas être vérifiée", () => {
  assert.ok(checkDailyDose("IBU-SIR", 100, 3, undefined)?.message.includes("Poids"));
});

test("un médicament sans règle n'est pas contrôlé", () => {
  assert.equal(checkDailyDose("SRO", 1000, 10, 10), null);
});

test("la dose structurée et la confirmation sont écrites dans la prescription", () => {
  const r = toFhirMedicationRequest("1", "2", { medication: "x", dosage: "y", doseMg: 125, dosesPerDay: 3 }, undefined, undefined, "alerte") as never as {
    dosageInstruction: { doseAndRate: { doseQuantity: { value: number } }[]; timing: { repeat: { frequency: number } } }[];
    extension: { url: string }[];
  };
  assert.equal(r.dosageInstruction[0].doseAndRate[0].doseQuantity.value, 125);
  assert.equal(r.dosageInstruction[0].timing.repeat.frequency, 3);
  assert.equal(r.extension.length, 1);
});

test("hasDoseRule distingue les médicaments contrôlés", async () => {
  const { hasDoseRule } = await import("../src/lib/dose-rules.js");
  assert.equal(hasDoseRule("PARA-SIR"), true);
  assert.equal(hasDoseRule("SRO"), false);
});

test("plafond absolu, contre-indication d'âge/poids et poids périmé", () => {
  // 80 kg, 4 x 1500 mg de paracétamol = 6000 mg/j : 75 mg/kg mais surtout au-delà de 4000 mg/j.
  assert.ok(checkDailyDose("PARA-CP", 1500, 4, 80)?.message.includes("plafond"));
  // Ibuprofène avant 3 mois et sous 5 kg.
  const young = checkDailyDose("IBU-SIR", 20, 3, 4, { ageMonths: 2 })?.message ?? "";
  assert.ok(young.includes("avant 3 mois") && young.includes("sous 5 kg"));
  // Poids de plus de 30 jours.
  const old = checkDailyDose("PARA-SIR", 100, 4, 10, { weightDate: "2026-08-01T00:00:00Z", now: new Date("2026-10-19T00:00:00Z") });
  assert.ok(old?.message.includes("à vérifier"));
  // Poids récent, dose correcte, âge adapté : rien.
  assert.equal(checkDailyDose("IBU-SIR", 100, 3, 12, { ageMonths: 24, weightDate: "2026-10-10T00:00:00Z", now: new Date("2026-10-19T00:00:00Z") }), null);
});
