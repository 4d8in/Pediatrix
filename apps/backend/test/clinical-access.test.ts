import { test } from "node:test";
import assert from "node:assert/strict";
import { canReadClinicalContent, canReadGuardian } from "../src/lib/clinical-access.js";

test("seuls médecin et infirmière lisent le contenu clinique", () => {
  assert.equal(canReadClinicalContent("doctor"), true);
  assert.equal(canReadClinicalContent("nurse"), true);
  for (const role of ["lab_tech", "radiologist", "director", "pharmacist", "cashier", "receptionist", "tech_admin"] as const) {
    assert.equal(canReadClinicalContent(role), false, role);
  }
});

test("le tuteur n'est visible que de l'accueil et des soignants", () => {
  for (const role of ["doctor", "nurse", "receptionist"] as const) assert.equal(canReadGuardian(role), true, role);
  for (const role of ["lab_tech", "radiologist", "director", "tech_admin"] as const) assert.equal(canReadGuardian(role), false, role);
});
