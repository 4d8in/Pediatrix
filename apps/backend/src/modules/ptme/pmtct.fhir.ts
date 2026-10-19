import { randomUUID } from "node:crypto";
import { PMTCT_CATEGORY_CODE, PMTCT_CATEGORY_SYSTEM, PMTCT_CODE_SYSTEM, isMilestone, type Enrolment, type MotherStatus, type TestResult } from "../../lib/pmtct.js";

const CATEGORY = [{ coding: [{ system: PMTCT_CATEGORY_SYSTEM, code: PMTCT_CATEGORY_CODE, display: "Suivi PTME" }] }];
const code = (c: string, display: string) => ({ coding: [{ system: PMTCT_CODE_SYSTEM, code: c, display }] });

function base(patientId: string, effective: string, performer: string) {
  return {
    resourceType: "Observation",
    status: "final",
    category: CATEGORY,
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: effective,
    performer: [{ display: performer }],
  };
}

export function toEnrolmentBundle(patientId: string, input: Enrolment, effective: string, performer: string) {
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      { fullUrl: `urn:uuid:${randomUUID()}`, resource: { ...base(patientId, effective, performer), code: code("mother-status", "Statut de la mère"), valueString: input.motherStatus }, request: { method: "POST", url: "Observation" } },
      { fullUrl: `urn:uuid:${randomUUID()}`, resource: { ...base(patientId, effective, performer), code: code("infant-prophylaxis", "Prophylaxie ARV du nourrisson"), valueBoolean: input.infantProphylaxis }, request: { method: "POST", url: "Observation" } },
    ],
  };
}

export function toTestObservation(patientId: string, milestone: string, result: string, effective: string, performer: string) {
  return { ...base(patientId, effective, performer), code: code(`test-${milestone}`, `Dépistage VIH ${milestone}`), valueString: result };
}

interface Obs {
  code?: { coding?: { code?: string }[] };
  valueString?: string;
  valueBoolean?: boolean;
  effectiveDateTime?: string;
}

export function fromPmtctBundle(bundle: { entry?: { resource: Obs }[] }): { enrolment: Enrolment | null; results: TestResult[] } {
  const observations = (bundle.entry ?? []).map((e) => e.resource);
  const find = (c: string) => observations.find((o) => o.code?.coding?.some((x) => x.code === c));
  const mother = find("mother-status")?.valueString;
  const prophylaxis = find("infant-prophylaxis")?.valueBoolean;
  const enrolment =
    mother && prophylaxis !== undefined ? { motherStatus: mother as MotherStatus, infantProphylaxis: prophylaxis } : null;
  const results: TestResult[] = [];
  for (const o of observations) {
    const c = o.code?.coding?.[0]?.code ?? "";
    if (!c.startsWith("test-")) continue;
    const milestone = c.slice(5);
    if (isMilestone(milestone) && (o.valueString === "negative" || o.valueString === "positive")) {
      results.push({ milestone, result: o.valueString, date: o.effectiveDateTime ?? "" });
    }
  }
  return { enrolment, results };
}
