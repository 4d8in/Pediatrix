import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";

interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id: string;
  code?: { text?: string };
  subject?: { reference?: string };
  requester?: { display?: string };
  authoredOn?: string;
}

interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: { family?: string; given?: string[] }[];
}

interface FhirBundle {
  entry?: { resource: FhirServiceRequest | FhirPatient }[];
}

interface LabRequestSummary {
  id: string;
  patientId: string;
  patientName: string;
  exam: string | null;
  requester: string | null;
  authoredOn: string | null;
}

function parseLabRequests(bundle: FhirBundle): LabRequestSummary[] {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource);
  const serviceRequests = resources.filter((r): r is FhirServiceRequest => r.resourceType === "ServiceRequest");
  const patients = resources.filter((r): r is FhirPatient => r.resourceType === "Patient");

  return serviceRequests
    .map((sr): LabRequestSummary => {
      const patientId = sr.subject?.reference?.split("/")[1] ?? "";
      const patient = patients.find((p) => p.id === patientId);
      const name = patient?.name?.[0];
      const patientName = name ? `${name.given?.[0] ?? ""} ${name.family ?? ""}`.trim() : "";

      return {
        id: sr.id,
        patientId,
        patientName,
        exam: sr.code?.text ?? null,
        requester: sr.requester?.display ?? null,
        authoredOn: sr.authoredOn ?? null,
      };
    })
    .sort((a, b) => (b.authoredOn ?? "").localeCompare(a.authoredOn ?? ""));
}

export async function listLabRequestsRoute(app: FastifyInstance) {
  app.get("/api/lab/requests", async (_request, reply) => {
    try {
      const bundle = await hapiClient.get<FhirBundle>(
        "/ServiceRequest?status=active&_include=ServiceRequest:subject&_sort=-authored",
      );
      return reply.send({ requests: parseLabRequests(bundle) });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
