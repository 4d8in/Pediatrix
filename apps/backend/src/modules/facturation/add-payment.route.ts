import type { FastifyInstance } from "fastify";
import { withLock } from "../../lib/keyed-lock.js";
import { hapiClient } from "../../lib/hapi-client.js";
import { loadTariffs } from "../../lib/tariffs.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { PAYMENT_METHODS, type PaymentMethod, toPaymentNotice } from "./billing.fhir.js";
import { replyHapiError } from "./billing-errors.js";
import { readInvoice } from "./invoice-reader.js";

// Encaissement d'un paiement du patient ; la facture est soldée quand sa part est payée.
export async function addPaymentRoute(app: FastifyInstance) {
  app.post("/api/billing/invoices/:id/payments", { preHandler: [authenticate, authorize("cashier")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const b = (request.body ?? {}) as Record<string, unknown>;
    const amount = typeof b.amount === "number" ? b.amount : Number(b.amount);
    const method = b.method as PaymentMethod;

    const errors: string[] = [];
    if (!Number.isInteger(amount) || amount <= 0) errors.push("Le montant doit être un entier positif.");
    if (!PAYMENT_METHODS.includes(method)) errors.push("Mode de paiement invalide.");
    if (errors.length > 0) return reply.code(400).send({ error: "Requête invalide.", details: errors });

    try {
      return await withLock(`invoice:${id}`, async () => {
      const invoice = await readInvoice(id);
      if (invoice.status === "balanced") return reply.code(409).send({ error: "Cette facture est déjà soldée." });
      if (amount > invoice.balance) {
        return reply.code(409).send({ error: `Le montant dépasse le solde restant (${invoice.balance} ${invoice.currency}).` });
      }

      const tariffs = await loadTariffs();
      await hapiClient.post("/PaymentNotice", toPaymentNotice(id, amount, method, tariffs.currency, request.user.name));

      if (amount === invoice.balance) {
        const resource = await hapiClient.get<Record<string, unknown>>(`/Invoice/${id}`, { "Cache-Control": "no-cache" });
        await hapiClient.put(`/Invoice/${id}`, { ...resource, status: "balanced" });
      }
      return reply.code(201).send({ invoice: await readInvoice(id) });
      });
    } catch (error) {
      return replyHapiError(reply, error, "Facture introuvable.");
    }
  });
}
