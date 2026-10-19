import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMULARY, findFormularyItem } from "../src/lib/formulary.js";
import { computeStock, stockOf, toMedicationDispense, toSupplyDelivery } from "../src/modules/pharmacie/stock.fhir.js";
import { parsePendingPrescriptions } from "../src/modules/pharmacie/list-pending-prescriptions.route.js";

const paracetamol = findFormularyItem("PARA-SIR")!;

test("le formulaire a des codes uniques et des seuils positifs", () => {
  const codes = FORMULARY.map((item) => item.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(FORMULARY.every((item) => item.reorderLevel > 0 && item.unit));
});

test("le stock est la somme des réceptions moins les délivrances", () => {
  const receipt = toSupplyDelivery(paracetamol, { itemCode: "PARA-SIR", quantity: 50, lot: "L1", expiry: "2027-06-30" }, "Pharmacien");
  const dispense = toMedicationDispense(paracetamol, 8, "mr1", "Patient/p1", "Encounter/e1", "Pharmacien");

  const levels = computeStock([receipt], [dispense]);
  assert.equal(stockOf(levels, "PARA-SIR"), 42);
  assert.equal(stockOf(levels, "SRO"), 0);
});

test("un article sous son seuil est signalé à réapprovisionner", () => {
  const receipt = toSupplyDelivery(paracetamol, { itemCode: "PARA-SIR", quantity: 10 }, "Pharmacien");
  const level = computeStock([receipt], []).find((l) => l.code === "PARA-SIR")!;
  assert.equal(level.quantity, 10);
  assert.equal(level.low, true);

  const full = toSupplyDelivery(paracetamol, { itemCode: "PARA-SIR", quantity: paracetamol.reorderLevel }, "Pharmacien");
  assert.equal(computeStock([full], []).find((l) => l.code === "PARA-SIR")!.low, false);
});

test("la réception garde lot et péremption, et la délivrance référence l'ordonnance", () => {
  const receipt = toSupplyDelivery(paracetamol, { itemCode: "PARA-SIR", quantity: 5, lot: "L9", expiry: "2027-01-31" }, "Pharmacien");
  assert.equal(receipt.extension?.length, 2);

  const dispense = toMedicationDispense(paracetamol, 2, "mr7", "Patient/p1", undefined, "Pharmacien");
  assert.deepEqual(dispense.authorizingPrescription, [{ reference: "MedicationRequest/mr7" }]);
  assert.equal(dispense.context, undefined);
});

test("les ordonnances à délivrer sont triées de la plus ancienne à la plus récente, avec le nom du patient", () => {
  const list = parsePendingPrescriptions({
    entry: [
      { resource: { resourceType: "Patient", id: "p1", name: [{ family: "Diallo", given: ["Moussa"] }] } },
      { resource: { resourceType: "MedicationRequest", id: "b", subject: { reference: "Patient/p1" }, authoredOn: "2026-10-02T10:00:00Z", medicationCodeableConcept: { text: "Amoxicilline" } } },
      { resource: { resourceType: "MedicationRequest", id: "a", subject: { reference: "Patient/p1" }, authoredOn: "2026-10-01T10:00:00Z" } },
    ],
  });
  assert.deepEqual(list.map((p) => p.id), ["a", "b"]);
  assert.equal(list[0].patientName, "Moussa Diallo");
});

function receiptAt(at: string, quantity: number, expiry: string) {
  return { ...toSupplyDelivery(paracetamol, { itemCode: "PARA-SIR", quantity, expiry }, "P"), occurrenceDateTime: at };
}
function dispenseAt(at: string, quantity: number) {
  return { ...toMedicationDispense(paracetamol, quantity, "mr", "Patient/p1", undefined, "P"), whenHandedOver: at };
}

test("un lot périmé n'est plus utilisable et la délivrance prélève dans le lot valide qui périme le plus tôt", () => {
  const now = new Date("2026-10-19T08:00:00Z");
  const lotA = receiptAt("2026-01-10T08:00:00Z", 20, "2026-10-01"); // périme avant now
  const lotB = receiptAt("2026-01-10T08:00:00Z", 30, "2026-12-15");
  const lotC = receiptAt("2026-01-10T08:00:00Z", 40, "2028-01-01");
  // Délivrance en mars : A est encore valide, il part en premier (FEFO).
  const level = computeStock([lotA, lotB, lotC], [dispenseAt("2026-03-01T08:00:00Z", 10)], now).find((l) => l.code === "PARA-SIR")!;
  assert.equal(level.expiredQuantity, 10); // reste de A, périmé
  assert.equal(level.quantity, 70);
  assert.equal(level.expiringSoonQuantity, 30);
});

test("un lot reçu après une délivrance ne peut pas l'avoir fournie", () => {
  const now = new Date("2026-10-19T08:00:00Z");
  const lotB = receiptAt("2026-01-10T08:00:00Z", 100, "2027-12-31");
  const dispense = dispenseAt("2026-02-10T08:00:00Z", 100); // vide le lot B
  const lotA = receiptAt("2026-03-10T08:00:00Z", 100, "2026-10-01"); // reçu après, périmé à now
  const level = computeStock([lotB, lotA], [dispense], now).find((l) => l.code === "PARA-SIR")!;
  assert.equal(level.quantity, 0); // et non 100
  assert.equal(level.expiredQuantity, 100);
});

test("sans péremption renseignée, le lot n'expire pas", () => {
  const receipt = toSupplyDelivery(paracetamol, { itemCode: "PARA-SIR", quantity: 50 }, "P");
  const level = computeStock([receipt], [], new Date("2030-01-01")).find((l) => l.code === "PARA-SIR")!;
  assert.equal(level.quantity, 50);
  assert.equal(level.expiredQuantity, 0);
});
