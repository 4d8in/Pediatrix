import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { type CreateReferralInput, toFhirReferral } from "./referral.fhir.js";

function validate(body: unknown): { input: CreateReferralInput } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const destination = typeof b.destination === "string" ? b.destination.trim() : "";
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  const summary = typeof b.summary === "string" && b.summary.trim() ? b.summary.trim() : undefined;

  const errors: string[] = [];
  if (!destination) errors.push("La structure de destination est requise.");
  if (!reason) errors.push("Le motif de la référence est requis.");
  if (summary && summary.length > 4000) errors.push("Le résumé clinique est trop long (4000 caractères maximum).");
  if (errors.length > 0) return { errors };
  return { input: { destination, reason, summary, urgent: b.urgent === true } };
}

export async function createReferralRoute(app: FastifyInstance) {
  app.post("/api/encounters/:id/referral", { preHandler: [authenticate, authorize("doctor")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = validate(request.body);
    if ("errors" in result) return reply.code(400).send({ error: "Requête invalide.", details: result.errors });

    try {
      const encounter = await hapiClient.get<{ subject?: { reference?: string } }>(`/Encounter/${id}`);
      const patientId = encounter.subject?.reference?.split("/")[1];
      if (!patientId) return reply.code(502).send({ error: "Consultation sans patient associé." });

      const created = await hapiClient.post<{ id: string }>(
        "/Communication",
        toFhirReferral(patientId, id, result.input, { id: request.user.sub, name: request.user.name }),
      );
      return reply.code(201).send({ referralId: created.id });
    } catch (error) {
      if (error instanceof HapiError) {
        const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
        return reply.code(statusCode).send({ error: error.statusCode === 404 ? "Consultation introuvable." : error.message });
      }
      throw error;
    }
  });
}
