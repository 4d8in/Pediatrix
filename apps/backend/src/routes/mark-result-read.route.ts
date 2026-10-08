import type { FastifyInstance } from "fastify";
import { markReportRead } from "../lib/read-store.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";

// Marque un résultat (DiagnosticReport) comme lu par le médecin connecté.
export async function markResultReadRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/results/:id/read",
    { preHandler: [authenticate, authorize("doctor")] },
    async (request, reply) => {
      await markReportRead(request.user.sub, request.params.id);
      return reply.send({ ok: true });
    },
  );
}
