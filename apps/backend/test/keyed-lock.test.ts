import { test } from "node:test";
import assert from "node:assert/strict";
import { withLock } from "../src/lib/keyed-lock.js";

test("withLock sérialise les tâches d'une même clé", async () => {
  const order: string[] = [];
  const slow = withLock("k", async () => {
    await new Promise((r) => setTimeout(r, 30));
    order.push("a");
  });
  const fast = withLock("k", async () => {
    order.push("b");
  });
  await Promise.all([slow, fast]);
  assert.deepEqual(order, ["a", "b"]);
});

test("withLock continue après l'échec d'une tâche", async () => {
  await assert.rejects(withLock("e", async () => { throw new Error("x"); }));
  assert.equal(await withLock("e", async () => 1), 1);
});
