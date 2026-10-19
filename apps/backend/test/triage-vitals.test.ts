import { test } from "node:test";
import assert from "node:assert/strict";
import { criticalVitals, latestVitalsByEncounter, parseTriageVitals, toTriageVitalObservations } from "../src/lib/triage-vitals.js";

test("parseTriageVitals accepte des valeurs plausibles et refuse une faute de frappe", () => {
  assert.deepEqual(parseTriageVitals({ temperature: "38,5", spo2: 97 }), { vitals: { temperature: 38.5, spo2: 97 } });
  assert.ok("errors" in parseTriageVitals({ temperature: 385 }));
  assert.ok("errors" in parseTriageVitals({ spo2: 140 }));
  assert.deepEqual(parseTriageVitals(undefined), { vitals: {} });
});

test("criticalVitals signale hypoxie et température extrême seulement", () => {
  assert.deepEqual(criticalVitals({ spo2: 88 }), ["spo2"]);
  assert.deepEqual(criticalVitals({ temperature: 40 }), ["temperature"]);
  assert.deepEqual(criticalVitals({ temperature: 37.2, spo2: 98, heartRate: 150 }), []);
});

test("les observations écrites sont relues par consultation, la plus récente gagne", () => {
  const written = toTriageVitalObservations("1", "9", { temperature: 38, spo2: 95 }, { id: "n1", name: "Inf" });
  assert.equal(written.length, 2);
  const read = latestVitalsByEncounter([...written, { ...written[0], effectiveDateTime: "2999-01-01T00:00:00Z", valueQuantity: { value: 39 } }] as never);
  assert.deepEqual(read.get("9"), { temperature: 39, spo2: 95 });
});
