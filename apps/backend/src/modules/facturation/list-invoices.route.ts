import type { FastifyInstance } from "fastify";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { replyHapiError } from "./billing-errors.js";
import { readAllInvoices } from "./invoice-reader.js";

export async function listInvoicesRoute(app: FastifyInstance) {
  app.get("/api/billing/invoices", { preHandler: [authenticate, authorize("cashier", "director")] }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    try {
      const all = await readAllInvoices();
      const invoices = status === "issued" || status === "balanced" ? all.filter((i) => i.status === status) : all;
      return reply.send({ invoices });
    } catch (error) {
      return replyHapiError(reply, error);
    }
  });
}
