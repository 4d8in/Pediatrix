import type { FastifyInstance } from "fastify";
import { HapiError } from "../lib/hapi-client.js";
import { INDICATOR_LABELS, indicatorLabel, isValidPeriod, loadMapping } from "../lib/dhis2.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";
import { DIAGNOSIS_NAMES, computeMonthlyIndicators } from "./reporting-indicators.js";

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7).replace("-", "");
}

// Indicateurs d'activité d'un mois, avec leur état de correspondance DHIS2.
export async function reportingIndicatorsRoute(app: FastifyInstance) {
  app.get(
    "/api/reporting/indicators",
    { preHandler: [authenticate, authorize("director", "tech_admin")] },
    async (request, reply) => {
      const period = (request.query as { period?: string }).period ?? currentPeriod();
      if (!isValidPeriod(period)) return reply.code(400).send({ error: "Période invalide (AAAAMM)." });

      try {
        const [indicators, mapping] = await Promise.all([computeMonthlyIndicators(period), loadMapping()]);
        const known = Object.keys(INDICATOR_LABELS);
        const ids = [...known, ...Object.keys(indicators).filter((id) => !known.includes(id)).sort()];
        return reply.send({
          period,
          mappingConfigured: Boolean(mapping),
          indicators: ids.map((id) => ({
            id,
            label: indicatorLabel(id, DIAGNOSIS_NAMES),
            value: indicators[id] ?? 0,
            mapped: Boolean(mapping?.dataElements[id]),
          })),
        });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
