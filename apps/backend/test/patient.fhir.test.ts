import { test } from "node:test";
import assert from "node:assert/strict";
import { fromFhirPatient, toFhirPatient } from "../src/socle/patients/patient.fhir.js";

const input = {
  firstName: "Aïcha",
  lastName: "Test",
  birthDate: "2020-03-14",
  gender: "female" as const,
  guardian: { name: "Moussa Kane", relationship: "Père", phone: "+221701112233" },
};

test("toFhirPatient produit une ressource Patient FHIR conforme", () => {
  const patient = toFhirPatient(input);
  assert.equal(patient.resourceType, "Patient");
  assert.deepEqual(patient.name, [{ family: "Test", given: ["Aïcha"] }]);
  assert.equal(patient.birthDate, "2020-03-14");
  assert.equal(patient.contact?.[0].telecom?.[0].value, "+221701112233");
});

test("fromFhirPatient relit ce que toFhirPatient a écrit (aller-retour)", () => {
  const summary = fromFhirPatient({ ...toFhirPatient(input), id: "42" });
  assert.deepEqual(summary, { id: "42", ...input });
});

test("fromFhirPatient tolère une ressource incomplète", () => {
  const summary = fromFhirPatient({ resourceType: "Patient", id: "7" });
  assert.equal(summary.gender, "unknown");
  assert.equal(summary.guardian, null);
});
