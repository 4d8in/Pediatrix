import { test } from "node:test";
import assert from "node:assert/strict";
import { DIAGNOSES, findDiagnosis } from "../src/lib/diagnoses.js";
import { summarizeCondition, toFhirCondition } from "../src/modules/pediatrie/diagnosis.fhir.js";
import { toEncounterTransactionBundle } from "../src/modules/pediatrie/encounter.fhir.js";
import { toFhirServiceRequest } from "../src/modules/pediatrie/service-request.fhir.js";
import { idFromMrn, mrnFromId, fromFhirPatient, toFhirPatient } from "../src/socle/patients/patient.fhir.js";

test("le numéro de dossier dérive de l'id et se retrouve à la saisie", () => {
  assert.equal(mrnFromId("1401"), "PX-001401");
  assert.equal(idFromMrn("PX-001401"), "1401");
  assert.equal(idFromMrn("px1401"), "1401");
  assert.equal(idFromMrn("Diallo"), undefined);
  assert.equal(idFromMrn("PX-"), undefined);
});

test("le numéro est lu dans l'identifiant FHIR, sinon recalculé pour un ancien dossier", () => {
  const input = { firstName: "Awa", lastName: "Sow", birthDate: "2020-01-01", gender: "female" as const, guardian: { name: "M", relationship: "Mère", phone: "1" } };
  const old = fromFhirPatient({ ...toFhirPatient(input), id: "77" });
  assert.equal(old.mrn, "PX-000077");

  const stored = fromFhirPatient({ ...toFhirPatient(input), id: "77", identifier: [{ system: "http://pediatrix.local/fhir/mrn", value: "PX-000077" }] });
  assert.equal(stored.mrn, "PX-000077");
});

test("le catalogue CIM-10 a des codes uniques et un libellé", () => {
  const codes = DIAGNOSES.map((d) => d.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(DIAGNOSES.every((d) => d.display.length > 3));
  assert.equal(findDiagnosis("B50.9")?.display.startsWith("Paludisme"), true);
});

test("un diagnostic codé devient une Condition CIM-10 liée à la consultation et au médecin", () => {
  const diagnosis = findDiagnosis("J18.9")!;
  const condition = toFhirCondition("p1", "e1", { code: "J18.9", text: diagnosis.display, certainty: "provisional" }, diagnosis, { id: "d1", name: "Dr. Sall" });

  assert.equal(condition.code.coding?.[0].system, "http://hl7.org/fhir/sid/icd-10");
  assert.equal(condition.encounter.reference, "Encounter/e1");
  assert.equal(condition.recorder.reference, "Practitioner/d1");

  const summary = summarizeCondition({ ...condition, id: "c1" });
  assert.deepEqual([summary.code, summary.certainty, summary.encounterId, summary.recorder], ["J18.9", "provisional", "e1", "Dr. Sall"]);
});

test("un diagnostic libre garde son texte, sans code", () => {
  const condition = toFhirCondition("p1", "e1", { text: "Éruption à préciser", certainty: "confirmed" }, undefined, { id: "d1", name: "Dr. Sall" });
  assert.equal(condition.code.coding, undefined);
  assert.equal(summarizeCondition({ ...condition, id: "c2" }).code, null);
});

test("la consultation et la demande d'examen portent le praticien", () => {
  const bundle = toEncounterTransactionBundle("p1", { reason: "Fièvre", vitals: {} }, { id: "d1", name: "Dr. Sall" });
  const encounter = (bundle.entry[0] as { resource: { participant?: { individual: { reference: string } }[] } }).resource;
  assert.equal(encounter.participant?.[0].individual.reference, "Practitioner/d1");

  const request = toFhirServiceRequest("p1", "e1", { exam: "NFS", requester: "Dr. Sall" }, "d1");
  assert.equal(request.requester.reference, "Practitioner/d1");
  assert.equal(toFhirServiceRequest("p1", "e1", { exam: "NFS", requester: "Dr. Sall" }).requester.display, "Dr. Sall");
});
