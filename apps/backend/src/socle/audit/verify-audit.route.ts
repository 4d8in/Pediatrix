import type { FastifyInstance } from "fastify";
import { readChain, verifyChain } from "../../lib/audit-chain.js";
import { fetchAll } from "../../lib/fhir-search.js";
import { HapiError } from "../../lib/hapi-client.js";
import { readChainStart, writeChainStart } from "./audit-chain-start.js";
import { authenticate } from "../auth/authenticate.js";
import { authorize } from "../auth/authorize.js";

// Vérifie l'intégrité du journal d'audit (chaîne d'empreintes). Renvoie aussi la dernière empreinte, à noter
// régulièrement hors du serveur : elle prouve qu'aucun événement antérieur n'a été réécrit depuis.
export async function verifyAuditRoute(app: FastifyInstance) {
  app.get("/api/audit/verify", { preHandler: [authenticate, authorize("tech_admin")] }, async (_request, reply) => {
    try {
      let start = await readChainStart();
      let events: Record<string, unknown>[];
      if (start) {
        events = await fetchAll<Record<string, unknown>>(`/AuditEvent?_lastUpdated=ge${encodeURIComponent(start)}&_sort=_lastUpdated`);
      } else {
        // Première vérification : lecture complète, puis mémorisation du début de la chaîne.
        events = await fetchAll<Record<string, unknown>>("/AuditEvent?_sort=_lastUpdated");
        const first = events.find((e) => readChain(e) !== null) as { meta?: { lastUpdated?: string } } | undefined;
        if (first?.meta?.lastUpdated) {
          start = new Date(Date.parse(first.meta.lastUpdated) - 60_000).toISOString();
          await writeChainStart(start).catch(() => undefined);
        }
      }
      return reply.send(verifyChain(events));
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
