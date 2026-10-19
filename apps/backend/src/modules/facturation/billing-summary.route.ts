import type { FastifyInstance } from "fastify";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { replyHapiError } from "./billing-errors.js";
import { readAllInvoices } from "./invoice-reader.js";

// Chiffres de la direction : encaissé aujourd'hui, restant dû, part des assureurs.
export async function billingSummaryRoute(app: FastifyInstance) {
  app.get("/api/billing/summary", { preHandler: [authenticate, authorize("cashier", "director")] }, async (_request, reply) => {
    try {
      const invoices = await readAllInvoices();
      const today = new Date().toISOString().slice(0, 10);
      const collectedToday = invoices
        .flatMap((i) => i.payments)
        .filter((p) => p.date?.startsWith(today))
        .reduce((sum, p) => sum + p.amount, 0);
      return reply.send({
        currency: invoices[0]?.currency ?? "XOF",
        invoices: invoices.length,
        collectedToday,
        outstanding: invoices.reduce((sum, i) => sum + i.balance, 0),
        insurerReceivable: invoices.reduce((sum, i) => sum + i.insurerShare, 0),
      });
    } catch (error) {
      return replyHapiError(reply, error);
    }
  });
}
