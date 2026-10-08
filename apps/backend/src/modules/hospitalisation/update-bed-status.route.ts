import type { FastifyInstance } from "fastify";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import type { BedStatus } from "./beds.fhir.js";
import { bedStatusOf } from "./beds.fhir.js";
import { getBed, hapiErrorReply, putBedEntry, runTransaction } from "./stay-store.js";

const SETTABLE: BedStatus[] = ["U", "H", "C"];

// Changer l'état d'un lit non occupé : libre, en nettoyage ou fermé.
// L'état "occupé" ne se pose que par une hospitalisation (cohérence avec les séjours).
export async function updateBedStatusRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/beds/:id/status",
    { preHandler: [authenticate, authorize("nurse", "tech_admin")] },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const status = body.status as BedStatus;
      if (!SETTABLE.includes(status)) {
        return reply.code(400).send({ error: "État invalide (attendu : U, H ou C)." });
      }

      try {
        const bed = await getBed(request.params.id);
        if (!bed) return reply.code(404).send({ error: "Lit introuvable." });
        if (bedStatusOf(bed) === "O") {
          return reply.code(409).send({ error: "Lit occupé : faites d'abord la sortie ou le transfert du patient." });
        }

        await runTransaction([putBedEntry(bed, status)]);
        return reply.send({ ok: true });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
