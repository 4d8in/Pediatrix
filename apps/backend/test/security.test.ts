import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCK_MS, LoginThrottle, MAX_FAILURES } from "../src/lib/login-throttle.js";
import {
  actionForMethod,
  outcomeForStatus,
  patientIdFor,
  shouldAudit,
  summarizeAuditEvent,
  toAuditEvent,
} from "../src/socle/audit/audit.fhir.js";

test("après 5 échecs, la connexion est bloquée 15 minutes puis ré-autorisée", () => {
  const throttle = new LoginThrottle();
  const t0 = 1_000_000;
  for (let i = 0; i < MAX_FAILURES - 1; i += 1) throttle.recordFailure("ip|medecin1", t0);
  assert.equal(throttle.retryAfterSeconds("ip|medecin1", t0), 0);

  throttle.recordFailure("ip|medecin1", t0);
  assert.equal(throttle.retryAfterSeconds("ip|medecin1", t0), LOCK_MS / 1000);
  assert.equal(throttle.retryAfterSeconds("ip|medecin1", t0 + LOCK_MS + 1), 0);

  // Un échec après l'expiration du verrou repart de zéro.
  throttle.recordFailure("ip|medecin1", t0 + LOCK_MS + 1);
  assert.equal(throttle.retryAfterSeconds("ip|medecin1", t0 + LOCK_MS + 1), 0);
});

test("un succès efface le compteur, et un autre identifiant n'est pas touché", () => {
  const throttle = new LoginThrottle();
  for (let i = 0; i < MAX_FAILURES; i += 1) throttle.recordFailure("ip|a", 0);
  assert.ok(throttle.retryAfterSeconds("ip|a", 1) > 0);
  assert.equal(throttle.retryAfterSeconds("ip|b", 1), 0);

  throttle.recordSuccess("ip|a");
  assert.equal(throttle.retryAfterSeconds("ip|a", 1), 0);
});

test("on journalise les écritures, les lectures de dossier et les refus, pas les rafraîchissements", () => {
  assert.equal(shouldAudit("POST", "/api/patients", 201, true), true);
  assert.equal(shouldAudit("GET", "/api/patients/:id", 200, true), true);
  assert.equal(shouldAudit("GET", "/api/lab/requests", 200, true), false); // rafraîchissement automatique
  assert.equal(shouldAudit("GET", "/api/lab/requests", 403, true), true); // refus de droits
  assert.equal(shouldAudit("GET", "/api/audit", 200, true), false);
  assert.equal(shouldAudit("GET", "/api/health", 200, true), false);
  assert.equal(shouldAudit("POST", "/api/patients", 401, false), false); // non authentifié
  assert.equal(shouldAudit("GET", "/updates/:file", 200, true), false);
});

test("action, résultat et patient visé se déduisent de la requête", () => {
  assert.equal(actionForMethod("GET"), "R");
  assert.equal(actionForMethod("post"), "C");
  assert.equal(actionForMethod("PUT"), "U");
  assert.equal(outcomeForStatus(201), "0");
  assert.equal(outcomeForStatus(403), "4");
  assert.equal(outcomeForStatus(502), "8");

  assert.equal(patientIdFor("/api/patients/:id/reports", { id: "p9" }, undefined), "p9");
  assert.equal(patientIdFor("/api/appointments", {}, { patientId: "p3" }), "p3");
  assert.equal(patientIdFor("/api/encounters/:id/prescriptions", { id: "e1" }, {}), undefined);
});

test("un AuditEvent relu redonne qui, quoi, résultat et patient", () => {
  const event = {
    ...toAuditEvent({
      action: "R",
      outcome: "0",
      agent: { id: "d1", name: "Dr. Diallo", role: "doctor" },
      ip: "192.168.1.20",
      entity: "Patient/p9",
      description: "GET /api/patients/:id → 200",
    }),
    id: "a1",
  };
  const summary = summarizeAuditEvent(event);
  assert.equal(summary.who, "Dr. Diallo");
  assert.equal(summary.role, "doctor");
  assert.equal(summary.patientId, "p9");
  assert.equal(summary.success, true);
  assert.equal(summary.ip, "192.168.1.20");
  assert.equal(summary.login, false);

  const login = summarizeAuditEvent(
    toAuditEvent({ action: "E", outcome: "4", agent: { name: "inconnu" }, description: "Connexion refusée.", login: true }),
  );
  assert.equal(login.login, true);
  assert.equal(login.success, false);
  assert.equal(login.description, "Connexion refusée.");
});

import { findUnsafeParam, isSafeId } from "../src/lib/safe-id.js";

test("seuls les identifiants simples passent : pas de « ? », « & », « / » ni d'espace", () => {
  assert.equal(isSafeId("1401"), true);
  assert.equal(isSafeId("abc-123_X.4"), true);
  assert.equal(isSafeId("1&_include=*"), false);
  assert.equal(isSafeId("1?x=y"), false);
  assert.equal(isSafeId("../Patient"), false);
  assert.equal(isSafeId("a b"), false);
  assert.equal(isSafeId(""), false);
  assert.equal(isSafeId("x".repeat(65)), false);
  assert.equal(isSafeId(undefined), false);
});

test("findUnsafeParam repère le paramètre fautif et laisse passer le nom de fichier des mises à jour", () => {
  assert.equal(findUnsafeParam({ id: "42" }), undefined);
  assert.equal(findUnsafeParam({ id: "42&x=1" }), "id");
  assert.equal(findUnsafeParam({ id: "42", username: "medecin1" }), undefined);
  assert.equal(findUnsafeParam({ file: "Pediatrix Setup 1.0.0.exe" }), undefined); // contrôlé par sa propre liste blanche
  assert.equal(findUnsafeParam(undefined), undefined);
});

import { assertHapiOrigin } from "../src/lib/hapi-client.js";

test("plafond par adresse : verrouille après le nombre d'échecs configuré", () => {
  const throttle = new LoginThrottle(3);
  for (let i = 0; i < 3; i += 1) throttle.recordFailure("10.0.0.1", 1_000);
  assert.ok(throttle.retryAfterSeconds("10.0.0.1", 2_000) > 0);
  assert.equal(throttle.retryAfterSeconds("10.0.0.2", 2_000), 0);
});

test("pagination HAPI : un lien vers un autre serveur est refusé", () => {
  assert.throws(() => assertHapiOrigin("http://evil.example/fhir?_getpages=1"));
  assert.equal(assertHapiOrigin("http://localhost:8080/fhir?_getpages=1"), "http://localhost:8080/fhir?_getpages=1");
});
