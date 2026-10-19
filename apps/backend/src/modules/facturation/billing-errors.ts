import type { FastifyReply } from "fastify";
import { HapiError } from "../../lib/hapi-client.js";

// Traduit une erreur HAPI en réponse propre (jamais de 500 brut) ; relance le reste.
export function replyHapiError(reply: FastifyReply, error: unknown, notFoundMessage?: string) {
  if (error instanceof HapiError) {
    const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
    const message = error.statusCode === 404 && notFoundMessage ? notFoundMessage : error.message;
    return reply.code(statusCode).send({ error: message });
  }
  throw error;
}
