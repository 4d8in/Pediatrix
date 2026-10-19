import type { FastifyInstance } from "fastify";
import { HapiError } from "../lib/hapi-client.js";
import { buildDataValueSet, clearMapping, isValidPeriod, loadMapping, saveMapping, validateMapping } from "../lib/dhis2.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";
import { computeMonthlyIndicators } from "./reporting-indicators.js";

export async function dhis2ExportRoute(app: FastifyInstance) {
  // Fichier au format « dataValueSet » de DHIS2, prêt à être importé.
  app.get("/api/reporting/dhis2", { preHandler: [authenticate, authorize("director", "tech_admin")] }, async (request, reply) => {
    const period = (request.query as { period?: string }).period ?? "";
    if (!isValidPeriod(period)) return reply.code(400).send({ error: "Période invalide (AAAAMM)." });

    const mapping = await loadMapping();
    if (!mapping) {
      return reply.code(409).send({
        error: "Correspondance DHIS2 non configurée : l'administrateur technique doit la renseigner (unité d'organisation et éléments de données).",
      });
    }
    try {
      const indicators = await computeMonthlyIndicators(period);
      return reply.send(buildDataValueSet(period, indicators, mapping));
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  app.get("/api/reporting/dhis2/mapping", { preHandler: [authenticate, authorize("tech_admin")] }, async (_request, reply) =>
    reply.send({ mapping: await loadMapping() }),
  );

  app.put("/api/reporting/dhis2/mapping", { preHandler: [authenticate, authorize("tech_admin")] }, async (request, reply) => {
    const result = validateMapping(request.body);
    if ("errors" in result) return reply.code(400).send({ error: "Correspondance invalide.", details: result.errors });
    await saveMapping(result.mapping);
    return reply.send({ mapping: result.mapping });
  });

  app.delete("/api/reporting/dhis2/mapping", { preHandler: [authenticate, authorize("tech_admin")] }, async (_request, reply) => {
    await clearMapping();
    return reply.code(204).send();
  });
}
