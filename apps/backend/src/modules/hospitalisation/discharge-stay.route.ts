import type { FastifyInstance } from "fastify";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { currentBedId } from "./beds.fhir.js";
import { getBed, getStay, hapiErrorReply, putBedEntry, putStayEntry, runTransaction } from "./stay-store.js";

// Sortie du patient : le séjour est terminé et le lit passe "en nettoyage".
export async function dischargeStayRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/hospitalisations/:id/discharge",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      try {
        const stay = await getStay(request.params.id);
        if (!stay) return reply.code(404).send({ error: "Séjour en cours introuvable." });

        const bedId = currentBedId(stay);
        const bed = bedId ? await getBed(bedId) : null;
        const now = new Date().toISOString();

        const finishedStay = {
          ...stay,
          status: "finished",
          period: { ...stay.period, end: now },
          location: (stay.location ?? []).map((entry) =>
            entry.status === "active" ? { ...entry, status: "completed", period: { ...entry.period, end: now } } : entry,
          ),
        };

        await runTransaction([putStayEntry(finishedStay), ...(bed ? [putBedEntry(bed, "H")] : [])]);
        return reply.send({ ok: true });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
