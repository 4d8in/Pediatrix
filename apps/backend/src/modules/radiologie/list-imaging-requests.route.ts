import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { IMAGING_CATEGORY_SEARCH_TOKEN } from "../../lib/service-category.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

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

interface ImagingRequestSummary {
  id: string;
  patientId: string;
  patientName: string;
  exam: string | null;
  requester: string | null;
  authoredOn: string | null;
}

function parseImagingRequests(bundle: FhirBundle): ImagingRequestSummary[] {
  const resources = (bundle.entry ?? []).map((entry) => entry.resource);
  const serviceRequests = resources.filter((r): r is FhirServiceRequest => r.resourceType === "ServiceRequest");
  const patients = resources.filter((r): r is FhirPatient => r.resourceType === "Patient");

  return serviceRequests
    .map((sr): ImagingRequestSummary => {
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

export async function listImagingRequestsRoute(app: FastifyInstance) {
  app.get(
    "/api/imaging/requests",
    { preHandler: [authenticate, authorize("radiologist")] },
    async (request, reply) => {
    // ?status=completed : demandes déjà traitées (historique des résultats envoyés).
    const { status } = request.query as { status?: string };
    const requestStatus = status === "completed" ? "completed" : "active";
      try {
        // Cf. list-lab-requests.route.ts : même besoin de cohérence immédiate
        // juste après la création d'une demande côté Pédiatrie.
        const bundle = await hapiClient.get<FhirBundle>(
          `/ServiceRequest?status=${requestStatus}&category=${IMAGING_CATEGORY_SEARCH_TOKEN}&_include=ServiceRequest:subject&_sort=-authored`,
          { "Cache-Control": "no-cache" },
        );
        return reply.send({ requests: parseImagingRequests(bundle) });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
