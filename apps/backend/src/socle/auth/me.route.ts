import type { FastifyInstance } from "fastify";
import { authenticate } from "./authenticate.js";

export async function meRoute(app: FastifyInstance) {
  app.get("/api/auth/me", { preHandler: [authenticate] }, async (request, reply) => {
    const { sub, role, name } = request.user;
    return reply.send({ id: sub, role, name });
  });
}
