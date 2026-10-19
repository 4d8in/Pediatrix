import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeReferral, toFhirReferral } from "../src/modules/reference/referral.fhir.js";

test("une référence urgente devient une Communication « referral » reliée à la consultation et au médecin", () => {
  const fhir = toFhirReferral(
    "p1",
    "e1",
    { destination: "CHU Aristide Le Dantec", reason: "Détresse respiratoire", summary: "Tirage sous-costal, SpO2 88 %", urgent: true },
    { id: "d1", name: "Dr. Diallo" },
  );
  assert.equal(fhir.resourceType, "Communication");
  assert.equal(fhir.category[0].coding[0].code, "referral");
  assert.equal(fhir.priority, "urgent");
  assert.equal(fhir.encounter.reference, "Encounter/e1");
  assert.equal(fhir.sender.reference, "Practitioner/d1");

  const summary = summarizeReferral({ ...fhir, id: "c1" });
  assert.deepEqual(
    [summary.destination, summary.reason, summary.summary, summary.urgent, summary.encounterId, summary.sender],
    ["CHU Aristide Le Dantec", "Détresse respiratoire", "Tirage sous-costal, SpO2 88 %", true, "e1", "Dr. Diallo"],
  );
});

test("une référence sans résumé reste valide et non urgente par défaut", () => {
  const fhir = toFhirReferral("p1", "e1", { destination: "Hôpital régional", reason: "Avis spécialisé", urgent: false }, { id: "d1", name: "Dr" });
  assert.equal(fhir.priority, "routine");
  assert.equal(fhir.payload, undefined);
  assert.equal(summarizeReferral({ ...fhir, id: "c2" }).summary, null);
});
