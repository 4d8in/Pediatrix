import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageGroupOf,
  buildDataValueSet,
  buildIndicators,
  isValidPeriod,
  periodRange,
  validateMapping,
} from "../src/lib/dhis2.js";

test("la période AAAAMM couvre le mois civil, de début inclus à fin exclue", () => {
  assert.equal(isValidPeriod("202610"), true);
  assert.equal(isValidPeriod("202613"), false);
  assert.equal(isValidPeriod("2026-10"), false);
  assert.deepEqual(periodRange("202610"), { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" });
  assert.deepEqual(periodRange("202612"), { start: "2026-12-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z" });
  assert.throws(() => periodRange("oct"), /invalide/);
});

test("la tranche d'âge se calcule à la date de la consultation", () => {
  const at = "2026-10-15T09:00:00.000Z";
  assert.equal(ageGroupOf("2026-03-01", at), "lt1");
  assert.equal(ageGroupOf("2024-10-15", at), "1_4");
  assert.equal(ageGroupOf("2019-01-01", at), "5_14");
  assert.equal(ageGroupOf("2000-01-01", at), "15p");
  assert.equal(ageGroupOf("2030-01-01", at), null); // naissance dans le futur
  assert.equal(ageGroupOf("pas-une-date", at), null);
});

test("les indicateurs comptent consultations par âge et sexe, activités et diagnostics", () => {
  const indicators = buildIndicators({
    consultations: [
      { date: "2026-10-02T08:00:00Z", birthDate: "2026-06-01", gender: "female" },
      { date: "2026-10-03T08:00:00Z", birthDate: "2023-01-01", gender: "male" },
      { date: "2026-10-04T08:00:00Z", birthDate: "2018-01-01", gender: "male" },
      { date: "2026-10-05T08:00:00Z" }, // dossier sans date de naissance ni sexe
    ],
    hospitalisations: 2,
    labRequests: 5,
    labReports: 4,
    imagingReports: 1,
    immunizations: 9,
    diagnosisCodes: ["B50.9", "B50.9", "J18.9", undefined],
  });

  assert.equal(indicators.consultations, 4);
  assert.equal(indicators.consultations_lt1, 1);
  assert.equal(indicators.consultations_1_4, 1);
  assert.equal(indicators.consultations_5_14, 1);
  assert.equal(indicators.consultations_15p, 0);
  assert.equal(indicators.consultations_male, 2);
  assert.equal(indicators.consultations_female, 1);
  assert.equal(indicators.hospitalisations, 2);
  assert.equal(indicators["dx_B50.9"], 2);
  assert.equal(indicators["dx_J18.9"], 1);
  assert.equal(Object.keys(indicators).some((k) => k === "dx_undefined"), false);
});

test("le fichier DHIS2 ne contient que les indicateurs mis en correspondance, le reste est listé", () => {
  const { dataValueSet, unmapped } = buildDataValueSet(
    "202610",
    { consultations: 120, immunizations: 40, "dx_B50.9": 30 },
    { orgUnit: "Ab12CdEf34G", dataSet: "Xy98ZwVu76T", dataElements: { consultations: "AAAAAAAAAA1", "dx_B50.9": "BBBBBBBBBB2" } },
    "2026-11-02",
  );
  assert.deepEqual(dataValueSet, {
    dataSet: "Xy98ZwVu76T",
    period: "202610",
    orgUnit: "Ab12CdEf34G",
    completeDate: "2026-11-02",
    dataValues: [
      { dataElement: "AAAAAAAAAA1", value: "120" },
      { dataElement: "BBBBBBBBBB2", value: "30" },
    ],
  });
  assert.deepEqual(unmapped, ["immunizations"]);
});

test("validateMapping exige des identifiants DHIS2 de 11 caractères", () => {
  assert.ok("mapping" in validateMapping({ orgUnit: "Ab12CdEf34G", dataElements: { consultations: "AAAAAAAAAA1" } }));
  assert.ok("errors" in validateMapping({ orgUnit: "trop-court", dataElements: {} }));
  assert.ok("errors" in validateMapping({ orgUnit: "Ab12CdEf34G", dataElements: { consultations: "123" } }));
  assert.ok("errors" in validateMapping({ orgUnit: "Ab12CdEf34G", dataSet: "x", dataElements: {} }));
});
