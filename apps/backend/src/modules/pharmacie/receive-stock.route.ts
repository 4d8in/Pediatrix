import type { FastifyInstance } from "fastify";
import { findFormularyItem } from "../../lib/formulary.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { type ReceiptInput, toSupplyDelivery } from "./stock.fhir.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validate(body: unknown): { input: ReceiptInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const itemCode = typeof b.itemCode === "string" ? b.itemCode.trim() : "";
  const quantity = typeof b.quantity === "number" ? b.quantity : Number(b.quantity);
  const lot = typeof b.lot === "string" && b.lot.trim() ? b.lot.trim() : undefined;
  const expiry = typeof b.expiry === "string" && b.expiry.trim() ? b.expiry.trim() : undefined;

  if (!findFormularyItem(itemCode)) errors.push("Article absent du formulaire.");
  if (!Number.isInteger(quantity) || quantity <= 0) errors.push("La quantité doit être un entier positif.");
  if (expiry && (!DATE_PATTERN.test(expiry) || Number.isNaN(Date.parse(expiry)))) {
    errors.push("Date de péremption invalide (format AAAA-MM-JJ).");
  } else if (expiry && expiry < new Date().toISOString().slice(0, 10)) {
    errors.push("Ce lot est déjà périmé : il ne peut pas être réceptionné.");
  }
  if (errors.length > 0) return { errors };
  return { input: { itemCode, quantity, lot, expiry } };
}

// Réception d'une livraison en pharmacie : augmente le stock de l'article.
export async function receiveStockRoute(app: FastifyInstance) {
  app.post("/api/pharmacy/stock/receipts", { preHandler: [authenticate, authorize("pharmacist")] }, async (request, reply) => {
    const result = validate(request.body);
    if ("errors" in result) {
      return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
    }
    const item = findFormularyItem(result.input.itemCode)!;

    try {
      const created = await hapiClient.post<{ id: string }>(
        "/SupplyDelivery",
        toSupplyDelivery(item, result.input, request.user.name),
      );
      return reply.code(201).send({ receiptId: created.id });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
