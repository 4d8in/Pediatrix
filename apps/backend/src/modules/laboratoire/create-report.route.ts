import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import {
  type FhirServiceRequestResource,
  parseReportTransactionResponse,
  toReportTransactionBundle,
} from "./report.fhir.js";
import { findCatalogEntry } from "../../lib/lab-catalog.js";
import { referenceFor } from "../../lib/lab-reference-ranges.js";
import { ageInMonths } from "../../lib/nutrition.js";
import type { CreateReportInput, LabResultInput } from "./report.types.js";

interface TransactionResponseBundle {
  entry?: { response?: { location?: string } }[];
}

// Champ numérique facultatif : absent -> undefined, saisie invalide -> NaN.
function optionalNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parsed = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validate(body: unknown): { input: CreateReportInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const rawResults = Array.isArray(b.results) ? b.results : [];
  const conclusion = typeof b.conclusion === "string" ? b.conclusion.trim() : "";

  const results: LabResultInput[] = [];
  for (const raw of rawResults) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const value = typeof r.value === "string" ? r.value.trim() : "";
    // Une ligne vide est ignorée, comme avant.
    if (!label || !value) continue;

    const code = typeof r.code === "string" && r.code.trim() ? r.code.trim() : undefined;
    if (code && !findCatalogEntry(code)) {
      errors.push(`Analyse "${label}" : code ${code} absent du catalogue.`);
    }
    const unit = typeof r.unit === "string" && r.unit.trim() ? r.unit.trim() : undefined;
    const referenceLow = optionalNumber(r.referenceLow);
    const referenceHigh = optionalNumber(r.referenceHigh);
    if (Number.isNaN(referenceLow) || Number.isNaN(referenceHigh)) {
      errors.push(`Analyse "${label}" : les bornes de référence doivent être des nombres.`);
    } else if (referenceLow !== undefined && referenceHigh !== undefined && referenceLow > referenceHigh) {
      errors.push(`Analyse "${label}" : la borne basse dépasse la borne haute.`);
    }

    results.push({
      label,
      value,
      code,
      unit,
      referenceLow: referenceLow === undefined || Number.isNaN(referenceLow) ? undefined : referenceLow,
      referenceHigh: referenceHigh === undefined || Number.isNaN(referenceHigh) ? undefined : referenceHigh,
    });
  }

  if (results.length === 0) {
    errors.push("Au moins un résultat (paramètre + valeur) est requis.");
  }

  if (errors.length > 0) return { errors };

  return { input: { results, conclusion: conclusion || undefined } };
}

export async function createReportRoute(app: FastifyInstance) {
  app.post(
    "/api/lab/requests/:id/report",
    { preHandler: [authenticate, authorize("lab_tech")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      let serviceRequest: FhirServiceRequestResource;
      try {
        serviceRequest = await hapiClient.get<FhirServiceRequestResource>(`/ServiceRequest/${id}`);
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          const message = error.statusCode === 404 ? "Demande d'examen introuvable." : error.message;
          return reply.code(statusCode).send({ error: message });
        }
        throw error;
      }

      if (serviceRequest.status === "completed") {
        return reply.code(409).send({ error: "Cette demande a déjà un rapport." });
      }

      const result = validate(request.body);
      if ("errors" in result) {
        return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
      }

      try {
        // Valeurs de référence par âge et sexe : bornes laissées vides par le technicien
        // remplies d'après le patient ; seuils critiques toujours ajoutés (drapeaux HH / LL).
        const patientId = serviceRequest.subject?.reference?.split("/")[1];
        if (patientId) {
          const patient = await hapiClient.get<{ birthDate?: string; gender?: string }>(`/Patient/${patientId}`);
          const months = patient.birthDate ? ageInMonths(patient.birthDate, new Date().toISOString()) : null;
          result.input.results = result.input.results.map((row) => {
            // Les références du catalogue valent pour l'unité du catalogue : unité saisie différente
            // (ex. mmol/L), aucune borne ni seuil critique automatique.
            const catalogUnit = row.code ? findCatalogEntry(row.code)?.unit : undefined;
            const sameUnit = !row.unit || !catalogUnit || row.unit === catalogUnit;
            const ref = row.code && sameUnit ? referenceFor(row.code, months, patient.gender ?? "unknown") : undefined;
            if (!ref) return row;
            const manual = row.referenceLow !== undefined || row.referenceHigh !== undefined;
            return {
              ...row,
              referenceLow: manual ? row.referenceLow : ref.low,
              referenceHigh: manual ? row.referenceHigh : ref.high,
              criticalLow: ref.criticalLow,
              criticalHigh: ref.criticalHigh,
            };
          });
        }
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
