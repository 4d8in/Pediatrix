import { test } from "node:test";
import assert from "node:assert/strict";
import { readDischarge, validateDischarge, withDischarge } from "../src/lib/discharge.js";

test("validateDischarge accepte une issue connue et refuse le reste", () => {
  assert.deepEqual(validateDischarge({ outcome: "healed", summary: " ok " }), { outcome: "healed", summary: "ok" });
  assert.deepEqual(validateDischarge({}), { outcome: undefined, summary: undefined });
  assert.ok("errors" in validateDischarge({ outcome: "inconnue" }));
  assert.ok("errors" in validateDischarge({ summary: "x".repeat(2001) }));
});

test("l'issue et le résumé s'écrivent dans le séjour et se relisent, sans perdre le reste", () => {
  const stay = { resourceType: "Encounter", id: "5", status: "in-progress", reasonCode: [{ text: "Paludisme grave" }] };
  const finished = withDischarge(stay, "deceased", "Décès à H48.") as typeof stay & {
    hospitalization: { dischargeDisposition: { coding: { code: string }[] } };
  };
  assert.equal(finished.hospitalization.dischargeDisposition.coding[0].code, "exp");
  assert.equal(finished.reasonCode[0].text, "Paludisme grave");
  assert.deepEqual(readDischarge(finished as never), { outcome: "deceased", summary: "Décès à H48." });
  // Sans saisie, le séjour est inchangé (compatibilité avec les anciens appels).
  assert.equal((withDischarge(stay) as { hospitalization?: unknown }).hospitalization, undefined);
});
