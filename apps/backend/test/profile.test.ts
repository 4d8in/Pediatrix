import { test } from "node:test";
import assert from "node:assert/strict";
import { fromFhirPractitioner, validateProfile, withProfile } from "../src/socle/auth/profile.fhir.js";
import type { FhirPractitioner } from "../src/socle/auth/profile.fhir.js";

const practitioner: FhirPractitioner = {
  resourceType: "Practitioner",
  id: "seed-medecin1",
  identifier: [{ system: "http://pediatrix.local/fhir/username", value: "medecin1" }],
  name: [{ text: "Dr. Awa Diallo" }],
  active: true,
};

test("validateProfile accepte un profil complet", () => {
  const result = validateProfile({
    displayName: "Dr. Awa Diallo",
    phone: "+221 77 000 00 00",
    email: "a.diallo@hopital.sn",
    photo: { contentType: "image/jpeg", data: "QUJD" },
  });
  assert.ok("profile" in result);
});

test("validateProfile refuse nom vide, e-mail et photo invalides", () => {
  const result = validateProfile({ displayName: " ", email: "pas-un-email", photo: { contentType: "image/gif", data: "QUJD" } });
  assert.ok("errors" in result);
  assert.equal(result.errors.length, 3);
});

test("withProfile met à jour nom, contacts et photo sans perdre l'identifiant ni l'état actif", () => {
  const updated = withProfile(practitioner, {
    displayName: "Dr. A. Diallo",
    phone: "+221770000000",
    email: null,
    photo: { contentType: "image/png", data: "QUJD" },
  });
  assert.deepEqual(updated.identifier, practitioner.identifier);
  assert.equal(updated.active, true);
  assert.deepEqual(fromFhirPractitioner(updated), {
    displayName: "Dr. A. Diallo",
    phone: "+221770000000",
    email: null,
    photo: { contentType: "image/png", data: "QUJD" },
  });
});

test("withProfile supprime la photo quand elle vaut null", () => {
  const withPhoto = withProfile(practitioner, { displayName: "X", phone: null, email: null, photo: { contentType: "image/png", data: "QUJD" } });
  const removed = withProfile(withPhoto, { displayName: "X", phone: null, email: null, photo: null });
  assert.equal(fromFhirPractitioner(removed).photo, null);
});
