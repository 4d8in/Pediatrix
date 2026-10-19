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
