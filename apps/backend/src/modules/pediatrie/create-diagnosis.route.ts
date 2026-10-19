import type { FastifyInstance } from "fastify";
import { findDiagnosis } from "../../lib/diagnoses.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { CERTAINTIES, type Certainty, toFhirCondition } from "./diagnosis.fhir.js";

// Diagnostic posé pendant une consultation : codé CIM-10 (catalogue) ou libre.
export async function createDiagnosisRoute(app: FastifyInstance) {
  app.post("/api/encounters/:id/diagnoses", { preHandler: [authenticate, authorize("doctor")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const b = (request.body ?? {}) as Record<string, unknown>;
    const code = typeof b.code === "string" && b.code.trim() ? b.code.trim() : undefined;
    const freeText = typeof b.text === "string" ? b.text.trim() : "";
    const certainty = (b.certainty ?? "confirmed") as Certainty;

    const diagnosis = code ? findDiagnosis(code) : undefined;
    const errors: string[] = [];
    if (code && !diagnosis) errors.push(`Code ${code} absent du catalogue CIM-10.`);
    if (!code && !freeText) errors.push("Choisissez un diagnostic du catalogue ou saisissez-le.");
    if (!CERTAINTIES.includes(certainty)) errors.push("Certitude invalide (confirmed ou provisional).");
    if (errors.length > 0) return reply.code(400).send({ error: "Requête invalide.", details: errors });

    try {
      const encounter = await hapiClient.get<{ subject?: { reference?: string } }>(`/Encounter/${id}`);
      const patientId = encounter.subject?.reference?.split("/")[1];
      if (!patientId) return reply.code(502).send({ error: "Consultation sans patient associé." });

      const created = await hapiClient.post<{ id: string }>(
        "/Condition",
        toFhirCondition(
          patientId,
          id,
          { code, text: diagnosis?.display ?? freeText, certainty },
          diagnosis,
          { id: request.user.sub, name: request.user.name },
        ),
      );
      return reply.code(201).send({ diagnosisId: created.id });
    } catch (error) {
      if (error instanceof HapiError) {
        const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({ error: error.statusCode === 404 ? "Consultation introuvable." : error.message });
      }
      throw error;
    }
  });
}
