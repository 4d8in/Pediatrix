import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { type FhirServiceRequest, toFhirServiceRequest } from "./imaging-request.fhir.js";
import type { CreateImagingRequestInput } from "./imaging-request.types.js";

interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  subject?: { reference?: string };
}

function validate(body: unknown): { input: CreateImagingRequestInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const exam = typeof b.exam === "string" ? b.exam.trim() : "";
  const requester = typeof b.requester === "string" ? b.requester.trim() : "";

  if (!exam) errors.push("L'examen d'imagerie demandé est requis.");
  if (!requester) errors.push("Le demandeur est requis.");

  if (errors.length > 0) return { errors };

  return { input: { exam, requester } };
}

export async function createImagingRequestRoute(app: FastifyInstance) {
  app.post(
    "/api/encounters/:id/imaging-requests",
    { preHandler: [authenticate, authorize("doctor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      let patientId: string | undefined;
      try {
        const encounter = await hapiClient.get<FhirEncounter>(`/Encounter/${id}`);
        patientId = encounter.subject?.reference?.split("/")[1];
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          const message = error.statusCode === 404 ? "Consultation introuvable." : error.message;
          return reply.code(statusCode).send({ error: message });
        }
        throw error;
      }

      if (!patientId) {
        return reply.code(502).send({ error: "Consultation sans patient associé." });
      }

      const result = validate(request.body);
      if ("errors" in result) {
        return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
      }

      try {
        const created = await hapiClient.post<FhirServiceRequest>(
          "/ServiceRequest",
          toFhirServiceRequest(patientId, id, result.input),
        );
        return reply.code(201).send({ imagingRequestId: created.id });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
