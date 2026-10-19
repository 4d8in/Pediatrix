import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { IMAGING_CATEGORY_SEARCH_TOKEN } from "../../lib/service-category.js";
import { authenticate } from "../auth/authenticate.js";
import { authorize } from "../auth/authorize.js";

const READ_ROLES = ["nurse", "doctor", "lab_tech"] as const;

interface FhirDiagnosticReport {
  resourceType: "DiagnosticReport";
  id: string;
  issued?: string;
  code?: { text?: string };
  conclusion?: string;
  result?: { reference?: string }[];
}

interface FhirObservation {
  resourceType: "Observation";
  id: string;
  code?: { text?: string };
  valueString?: string;
  valueQuantity?: { value?: number; unit?: string };
  referenceRange?: { low?: { value?: number }; high?: { value?: number } }[];
  interpretation?: { coding?: { code?: string }[] }[];
}

interface FhirBundle {
  entry?: { resource: FhirDiagnosticReport | FhirObservation }[];
}

interface ReportSummary {
  id: string;
  date: string | null;
  exam: string | null;
  conclusion: string | null;
  results: ReportResult[];
}

interface ReportResult {
  label: string;
  value: string;
  // H élevé, L bas, N normal ; absent quand aucune plage de référence n'a été saisie.
  flag?: "H" | "L" | "N";
  reference?: string;
}

function formatObservationValue(obs: FhirObservation): string {
  if (obs.valueString !== undefined) return obs.valueString;
  if (obs.valueQuantity?.value !== undefined) {
    return `${obs.valueQuantity.value}${obs.valueQuantity.unit ? ` ${obs.valueQuantity.unit}` : ""}`;
  }
  return "";
}

function readReference(obs: FhirObservation): string | undefined {
  const range = obs.referenceRange?.[0];
  const low = range?.low?.value;
  const high = range?.high?.value;
  if (low !== undefined && high !== undefined) return `${low} – ${high}`;
  if (low !== undefined) return `≥ ${low}`;
  if (high !== undefined) return `≤ ${high}`;
  return undefined;
}

function readFlag(obs: FhirObservation): ReportResult["flag"] {
  const code = obs.interpretation?.[0]?.coding?.[0]?.code;
  return code === "H" || code === "L" || code === "N" ? code : undefined;
}

function parseReports(bundle: FhirBundle): ReportSummary[] {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource);
  const reports = resources.filter((r): r is FhirDiagnosticReport => r.resourceType === "DiagnosticReport");
  const observations = resources.filter((r): r is FhirObservation => r.resourceType === "Observation");

  return reports
    .map((report): ReportSummary => {
      const results = (report.result ?? [])
        .map((ref): ReportResult | null => {
          const obsId = ref.reference?.split("/")[1];
          const obs = observations.find((o) => o.id === obsId);
          if (!obs) return null;
          return {
            label: obs.code?.text ?? "Résultat",
            value: formatObservationValue(obs),
            flag: readFlag(obs),
            reference: readReference(obs),
          };
        })
        .filter((r): r is ReportResult => r !== null);

      return {
        id: report.id,
        date: report.issued ?? null,
        exam: report.code?.text ?? null,
        conclusion: report.conclusion ?? null,
        results,
      };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export async function getPatientReportsRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/reports",
    { preHandler: [authenticate, authorize(...READ_ROLES)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await hapiClient.get(`/Patient/${id}`);
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          const message = error.statusCode === 404 ? "Patient introuvable." : error.message;
          return reply.code(statusCode).send({ error: message });
        }
        throw error;
      }

      try {
        // category:not=imagerie exclut les comptes-rendus du module Radiologie
        // (voir le même filtre dans laboratoire/list-lab-requests.route.ts).
        const bundle = await hapiClient.get<FhirBundle>(
          `/DiagnosticReport?patient=${id}&category:not=${IMAGING_CATEGORY_SEARCH_TOKEN}&_sort=-issued&_include=DiagnosticReport:result`,
        );
        return reply.send({ reports: parseReports(bundle) });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
