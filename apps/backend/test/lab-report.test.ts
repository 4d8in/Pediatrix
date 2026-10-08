import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReportTransactionResponse, toReportTransactionBundle } from "../src/modules/laboratoire/report.fhir.js";

const serviceRequest = {
  resourceType: "ServiceRequest" as const,
  id: "sr1",
  status: "active",
  code: { text: "NFS" },
  subject: { reference: "Patient/p1" },
  encounter: { reference: "Encounter/e1" },
};

test("le résultat labo crée Observations + DiagnosticReport et clôt la demande, en une transaction", () => {
  const bundle = toReportTransactionBundle(serviceRequest as never, {
    results: [
      { label: "Hémoglobine", value: "8.2 g/dL" },
      { label: "Plaquettes", value: "250 G/L" },
    ],
    conclusion: "Anémie",
  } as never);

  assert.equal(bundle.type, "transaction");
  const resources = bundle.entry.map((entry) => (entry as { resource: { resourceType: string } }).resource);
  assert.equal(resources.filter((r) => r.resourceType === "Observation").length, 2);

  const report = resources.find((r) => r.resourceType === "DiagnosticReport") as unknown as {
    basedOn: { reference: string }[];
    result: unknown[];
  };
  assert.deepEqual(report.basedOn, [{ reference: "ServiceRequest/sr1" }]);
  assert.equal(report.result.length, 2);

  const request = resources.find((r) => r.resourceType === "ServiceRequest") as unknown as { status: string };
  assert.equal(request.status, "completed");
});

test("parseReportTransactionResponse extrait l'id du DiagnosticReport", () => {
  const result = parseReportTransactionResponse({
    entry: [
      { response: { location: "Observation/o1/_history/1" } },
      { response: { location: "DiagnosticReport/d9/_history/1" } },
    ],
  });
  assert.equal(result.diagnosticReportId, "d9");
});

test("parseReportTransactionResponse échoue clairement si HAPI ne renvoie pas le rapport", () => {
  assert.throws(() => parseReportTransactionResponse({ entry: [] }), /identifiant du rapport introuvable/);
});
