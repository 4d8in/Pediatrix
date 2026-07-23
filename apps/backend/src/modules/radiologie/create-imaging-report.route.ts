import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import {
  type FhirServiceRequestResource,
  parseReportTransactionResponse,
  toReportTransactionBundle,
} from "./imaging-report.fhir.js";
import type { CreateImagingReportInput } from "./imaging-report.types.js";

interface TransactionResponseBundle {
  entry?: { response?: { location?: string } }[];
}

function validate(body: unknown): { input: CreateImagingReportInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const rawResults = Array.isArray(b.results) ? b.results : [];
  const conclusion = typeof b.conclusion === "string" ? b.conclusion.trim() : "";

  const results = rawResults
    .map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const label = typeof r.label === "string" ? r.label.trim() : "";
      const value = typeof r.value === "string" ? r.value.trim() : "";
      return { label, value };
    })
    .filter((r) => r.label && r.value);

  if (results.length === 0) {
    errors.push("Au moins une observation (zone examinée + constatation) est requise.");
  }

  if (errors.length > 0) return { errors };

  return { input: { results, conclusion: conclusion || undefined } };
}

export async function createImagingReportRoute(app: FastifyInstance) {
  app.post(
    "/api/imaging/requests/:id/report",
    { preHandler: [authenticate, authorize("radiologist")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      let serviceRequest: FhirServiceRequestResource;
      try {
        serviceRequest = await hapiClient.get<FhirServiceRequestResource>(`/ServiceRequest/${id}`);
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          const message = error.statusCode === 404 ? "Demande d'imagerie introuvable." : error.message;
          return reply.code(statusCode).send({ error: message });
        }
        throw error;
      }

      const result = validate(request.body);
      if ("errors" in result) {
        return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
      }

      try {
        const responseBundle = await hapiClient.post<TransactionResponseBundle>(
          "",
          toReportTransactionBundle(serviceRequest, result.input),
        );
        const { diagnosticReportId } = parseReportTransactionResponse(responseBundle);
        return reply.code(201).send({ diagnosticReportId });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
