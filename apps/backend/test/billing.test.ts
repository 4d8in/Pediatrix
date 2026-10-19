import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTariffs, validateTariffs } from "../src/lib/tariffs.js";
import {
  buildInvoiceLines,
  computeTotals,
  summarizeInvoice,
  toFhirInvoice,
  toPaymentNotice,
} from "../src/modules/facturation/billing.fhir.js";

const tariffs = { ...defaultTariffs(), consultation: 2000, labDefault: 3000, labByCode: { "718-7": 1500 }, imagingDefault: 10000, drugs: { "PARA-SIR": 400 } };

test("la facture contient la consultation, les examens (labo, imagerie) et les médicaments délivrés", () => {
  const lines = buildInvoiceLines(
    [
      { code: { text: "Hémoglobine", coding: [{ code: "718-7" }] } },
      { code: { text: "Goutte épaisse" } },
      { code: { text: "Radio thorax" }, category: [{ coding: [{ code: "imaging" }] }] },
    ],
    [{ medicationCodeableConcept: { text: "Paracétamol sirop", coding: [{ code: "PARA-SIR" }] }, quantity: { value: 3 } }],
    tariffs,
  );

  assert.deepEqual(lines.map((l) => [l.kind, l.amount]), [
    ["consultation", 2000],
    ["lab", 1500], // prix particulier du code LOINC
    ["lab", 3000], // prix par défaut
    ["imaging", 10000],
    ["drug", 1200], // 3 × 400
  ]);
});

test("la part de l'assureur est un pourcentage du total ; le patient paie le reste", () => {
  const lines = buildInvoiceLines([{ code: { text: "NFS" } }], [], tariffs); // 2000 + 3000
  assert.deepEqual(computeTotals(lines, 0), { total: 5000, insurerShare: 0, patientShare: 5000 });
  assert.deepEqual(computeTotals(lines, 80), { total: 5000, insurerShare: 4000, patientShare: 1000 });
  assert.deepEqual(computeTotals(lines, 33), { total: 5000, insurerShare: 1650, patientShare: 3350 });
});

test("le solde se déduit des encaissements de la facture, et d'elle seule", () => {
  const lines = buildInvoiceLines([], [], tariffs);
  const totals = computeTotals(lines, 50);
  const invoice = { ...toFhirInvoice("p1", "Aissatou Sow", "e1", lines, totals, "XOF", { insurer: "IPM", coveragePercent: 50 }, "Caissier"), id: "i1" };

  const payments = [
    { ...toPaymentNotice("i1", 400, "cash", "XOF", "Caissier") },
    { ...toPaymentNotice("other", 999, "cash", "XOF", "Caissier") },
  ];
  const summary = summarizeInvoice(invoice as never, payments as never);

  assert.equal(summary.total, 2000);
  assert.equal(summary.patientShare, 1000);
  assert.equal(summary.insurerShare, 1000);
  assert.equal(summary.insurer, "IPM");
  assert.equal(summary.paid, 400);
  assert.equal(summary.balance, 600);
  assert.equal(summary.encounterId, "e1");
  assert.equal(summary.payments.length, 1);
});

test("validateTariffs refuse un montant négatif et marque la grille comme personnalisée", () => {
  const base = defaultTariffs();
  const bad = validateTariffs({ consultation: -1, labDefault: 1, imagingDefault: 1, drugs: {} });
  assert.ok("errors" in bad);

  const good = validateTariffs({ consultation: 2500, labDefault: 3500, imagingDefault: 12000, drugs: { SRO: 100 } });
  assert.ok("tariffs" in good);
  if ("tariffs" in good) {
    assert.equal(good.tariffs.consultation, 2500);
    assert.equal(good.tariffs.drugs.SRO, 100);
    assert.equal(good.tariffs.drugs["PARA-SIR"], base.drugs["PARA-SIR"]); // article non précisé : prix conservé
    assert.equal(good.tariffs.customized, true);
  }
});
