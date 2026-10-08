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
  app.get("/api/lab/requests", { preHandler: [authenticate, authorize("lab_tech")] }, async (request, reply) => {
    // ?status=completed : demandes déjà traitées (historique des résultats envoyés).
    const { status } = request.query as { status?: string };
    const requestStatus = status === "completed" ? "completed" : "active";
    try {
      // Cohérence immédiate exigée : la file labo doit refléter les demandes tout
      // juste créées côté Pédiatrie. Sans cet en-tête, HAPI peut réutiliser un
      // résultat de recherche mis en cache pour cette même requête (paramètres
      // identiques) et masquer une demande fraîchement créée pendant un temps
      // variable et non borné (diagnostiqué en comparant, avec/sans cet en-tête,
      // une lecture directe par id, une recherche par _id, et cette recherche —
      // seule cette dernière, sans no-cache, restait périmée).
      //
      // category:not=imagerie exclut les demandes du module Radiologie, qui
      // partage le même serveur HAPI et le même type de ressource (ServiceRequest).
      // Les demandes labo existantes n'ont pas de `category` : le modificateur
      // `:not` les inclut quand même (absence de valeur = "not equal" satisfait).
      const bundle = await hapiClient.get<FhirBundle>(
        `/ServiceRequest?status=${requestStatus}&category:not=${IMAGING_CATEGORY_SEARCH_TOKEN}&_include=ServiceRequest:subject&_sort=-authored`,
        { "Cache-Control": "no-cache" },
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
