import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IdempotencyStore, KEY_PATTERN, fingerprintOf } from "../src/lib/idempotency.js";
import { parseOccurredAt } from "../src/lib/occurred-at.js";

test("parseOccurredAt : récent accepté, futur proche ramené à maintenant, trop loin ou trop vieux refusé", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  assert.deepEqual(parseOccurredAt(undefined, now), {});
  assert.deepEqual(parseOccurredAt("2026-10-20T10:00:00Z", now), { at: "2026-10-20T10:00:00.000Z" });
  // Horloge du poste en avance de 3 minutes : pas de refus, on ramène à l'instant présent.
  assert.deepEqual(parseOccurredAt("2026-10-20T12:03:00Z", now), { at: now.toISOString() });
  assert.ok("error" in parseOccurredAt("2026-10-20T13:00:00Z", now)); // trop loin dans le futur
  assert.ok("error" in parseOccurredAt("2026-10-19T10:00:00Z", now)); // plus de 24 h
  assert.ok("error" in parseOccurredAt("pas une date", now));
  assert.ok("error" in parseOccurredAt(42, now));
});

test("une réponse mémorisée est rejouée pour la même clé et le même utilisateur seulement", async () => {
  const dir = await mkdtemp(join(tmpdir(), "idem-"));
  const file = join(dir, "idempotency.json");
  const store = new IdempotencyStore(file);
  const key = "4f1c2d3e-aaaa-bbbb-cccc-1234567890ab";

  assert.equal(await store.get("u1", key), undefined);
  assert.equal(store.begin("u1", key), true);
  assert.equal(store.begin("u1", key), false); // déjà en cours
  await store.save("u1", key, 201, '{"encounterId":"7"}', "fp1");

  assert.equal((await store.get("u1", key))?.body, '{"encounterId":"7"}');
  assert.equal(await store.get("u2", key), undefined); // autre utilisateur
  assert.equal(store.begin("u1", key), true); // plus « en cours » après enregistrement

  // Persisté sur disque, lisible par le seul propriétaire, et relu par une nouvelle instance.
  assert.ok(JSON.parse(await readFile(file, "utf-8"))[`u1:${key}`]);
  assert.equal((await stat(file)).mode & 0o077, 0);
  assert.equal((await new IdempotencyStore(file).get("u1", key))?.status, 201);
});

test("une réponse trop ancienne n'est plus rejouée", async () => {
  const dir = await mkdtemp(join(tmpdir(), "idem-"));
  const store = new IdempotencyStore(join(dir, "i.json"));
  const key = "4f1c2d3e-aaaa-bbbb-cccc-1234567890ab";
  await store.save("u1", key, 201, "{}", "fp", 1_000);
  assert.equal(await store.get("u1", key, 1_000 + 8 * 86_400_000), undefined);
});

test("le format de clé accepte un UUID et refuse le reste", () => {
  assert.ok(KEY_PATTERN.test("4f1c2d3e-aaaa-bbbb-cccc-1234567890ab"));
  assert.ok(!KEY_PATTERN.test("court"));
  assert.ok(!KEY_PATTERN.test("../../etc/passwd-----------"));
});

test("l'empreinte distingue chemin et corps (une clé réutilisée pour autre chose est détectable)", () => {
  const a = fingerprintOf("POST", "/api/patients/1/triage", { category: "emergency" });
  assert.equal(a, fingerprintOf("POST", "/api/patients/1/triage", { category: "emergency" }));
  assert.notEqual(a, fingerprintOf("POST", "/api/patients/2/triage", { category: "emergency" }));
  assert.notEqual(a, fingerprintOf("POST", "/api/patients/1/triage", { category: "priority" }));
});

test("des sauvegardes simultanées ne corrompent pas le fichier", async () => {
  const dir = await mkdtemp(join(tmpdir(), "idem-"));
  const file = join(dir, "i.json");
  const store = new IdempotencyStore(file);
  const keys = Array.from({ length: 20 }, (_, i) => `4f1c2d3e-aaaa-bbbb-cccc-${String(i).padStart(12, "0")}`);
  await Promise.all(keys.map((k) => store.save("u1", k, 201, "{}", "fp")));
  const onDisk = JSON.parse(await readFile(file, "utf-8"));
  assert.equal(Object.keys(onDisk).length, 20);
});
