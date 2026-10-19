import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { hapiClient } from "../../lib/hapi-client.js";
import { type AuditInput, actionForMethod, outcomeForStatus, patientIdFor, shouldAudit, toAuditEvent } from "./audit.fhir.js";

// Écrit un AuditEvent sans jamais bloquer ni faire échouer la requête métier :
// une panne du journal est signalée dans les logs, pas à l'utilisateur.
export async function recordAudit(app: FastifyInstance, input: AuditInput): Promise<void> {
  try {
    await hapiClient.post("/AuditEvent", toAuditEvent(input));
  } catch (error) {
    app.log.warn({ err: error }, "Écriture du journal d'audit impossible.");
  }
}

export const auditPlugin = fp(async function auditPlugin(app: FastifyInstance) {
  app.addHook("onResponse", async (request, reply) => {
    const routeUrl = request.routeOptions?.url;
    const user = request.user as { sub?: string; name?: string; role?: string } | undefined;
    if (!shouldAudit(request.method, routeUrl, reply.statusCode, Boolean(user?.sub))) return;

    // Suivi PTME : le journal garde qui et quand, mais ni le patient ni la nature de l'acte (donnée très sensible).
    const confidential = routeUrl?.includes("/ptme") ?? false;
    const patientId = confidential ? undefined : patientIdFor(routeUrl, request.params, request.body);
    void recordAudit(app, {
      action: actionForMethod(request.method),
      outcome: outcomeForStatus(reply.statusCode),
      agent: { id: user?.sub, name: user?.name, role: user?.role },
      ip: request.ip,
      entity: patientId ? `Patient/${patientId}` : undefined,
      description: `${request.method} ${confidential ? "/api/patients/:id/[confidentiel]" : routeUrl}${
        !confidential && request.params && Object.keys(request.params as object).length > 0 ? ` ${JSON.stringify(request.params)}` : ""
      } → ${reply.statusCode}`,
    });
  });
});
