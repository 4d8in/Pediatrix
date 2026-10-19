import type { FastifyInstance } from "fastify";
import { HapiError } from "../../lib/hapi-client.js";
import { fetchAll } from "../../lib/fhir-search.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { computeStock } from "./stock.fhir.js";

export async function loadStockLevels() {
  const [receipts, dispenses] = await Promise.all([
    fetchAll<Record<string, unknown>>("/SupplyDelivery?status=completed"),
    fetchAll<Record<string, unknown>>("/MedicationDispense?status=completed"),
  ]);
  return computeStock(receipts, dispenses);
}

export async function stockLevelsRoute(app: FastifyInstance) {
  app.get(
    "/api/pharmacy/stock",
    { preHandler: [authenticate, authorize("pharmacist", "director")] },
    async (_request, reply) => {
      try {
        return reply.send({ items: await loadStockLevels() });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
