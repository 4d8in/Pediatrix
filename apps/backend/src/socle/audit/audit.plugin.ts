import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { GENESIS_HASH, readChain, withChain } from "../../lib/audit-chain.js";
import { writeChainStart } from "./audit-chain-start.js";
import { withLock } from "../../lib/keyed-lock.js";
import { hapiClient } from "../../lib/hapi-client.js";
import { type AuditInput, actionForMethod, outcomeForStatus, patientIdFor, shouldAudit, toAuditEvent } from "./audit.fhir.js";

// Écrit un AuditEvent sans jamais bloquer ni faire échouer la requête métier :
// une panne du journal est signalée dans les logs, pas à l'utilisateur.
// État de la chaîne (dernier numéro et empreinte) : relu depuis HAPI au premier événement après un démarrage.
let chainHead: { seq: number; hash: string } | null = null;

async function loadChainHead(): Promise<{ seq: number; hash: string }> {
  const bundle = await hapiClient.get<{ entry?: { resource: Record<string, unknown> }[] }>(
    "/AuditEvent?_sort=-_lastUpdated&_count=20",
    { "Cache-Control": "no-cache" },
  );
  const chains = (bundle.entry ?? []).map((e) => readChain(e.resource)).filter((c): c is { seq: number; hash: string } => c !== null);
  return chains.sort((a, b) => b.seq - a.seq)[0] ?? { seq: 0, hash: GENESIS_HASH };
}

export async function recordAudit(app: FastifyInstance, input: AuditInput): Promise<void> {
  try {
    // Écritures sérialisées : l'ordre de la chaîne est celui des enregistrements dans HAPI.
    await withLock("audit-chain", async () => {
      chainHead ??= await loadChainHead();
      const chained = withChain(toAuditEvent(input) as unknown as Record<string, unknown>, chainHead);
      await hapiClient.post("/AuditEvent", chained.event);
      if (chained.seq === 1) await writeChainStart(new Date(Date.now() - 60_000).toISOString()).catch(() => undefined);
      chainHead = { seq: chained.seq, hash: chained.hash };
    });
  } catch (error) {
    chainHead = null; // relu au prochain événement (l'état réel de HAPI fait foi)
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
