import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../auth/authenticate.js";
import { authorize } from "../auth/authorize.js";
import { summarizeAuditEvent } from "./audit.fhir.js";

const MAX_LIMIT = 200;

// Consultation du journal d'audit : direction et administration technique uniquement.
export async function listAuditRoute(app: FastifyInstance) {
  app.get("/api/audit", { preHandler: [authenticate, authorize("tech_admin", "director")] }, async (request, reply) => {
    const { limit, patientId } = request.query as { limit?: string; patientId?: string };
    const count = Math.min(Math.max(Number(limit) || 100, 1), MAX_LIMIT);
    const entity = patientId ? `&entity=Patient/${encodeURIComponent(patientId)}` : "";
    try {
      const bundle = await hapiClient.get<{ entry?: { resource: Record<string, unknown> }[] }>(
        `/AuditEvent?_sort=-date&_count=${count}${entity}`,
        { "Cache-Control": "no-cache" },
      );
      return reply.send({ events: (bundle.entry ?? []).map((e) => summarizeAuditEvent(e.resource as never)) });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
