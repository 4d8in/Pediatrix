import type { FastifyInstance } from "fastify";
import { authenticate } from "../socle/auth/authenticate.js";

// Identité de l'établissement (en-tête des documents imprimés), réglée par .env.
export async function facilityRoute(app: FastifyInstance) {
  app.get("/api/facility", { preHandler: [authenticate] }, async (_request, reply) =>
    reply.send({
      name: process.env.FACILITY_NAME ?? "Établissement de santé",
      address: process.env.FACILITY_ADDRESS ?? "",
      phone: process.env.FACILITY_PHONE ?? "",
    }),
  );
}
