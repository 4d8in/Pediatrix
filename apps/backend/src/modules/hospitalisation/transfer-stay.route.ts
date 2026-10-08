import type { FastifyInstance } from "fastify";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { bedStatusOf, currentBedId } from "./beds.fhir.js";
import { getBed, getStay, hapiErrorReply, putBedEntry, putStayEntry, runTransaction } from "./stay-store.js";

// Transfert d'un patient hospitalisé vers un autre lit libre. L'ancien lit passe
// "en nettoyage" ; l'historique des lits reste dans Encounter.location.
export async function transferStayRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/hospitalisations/:id/transfer",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const bedId = typeof body.bedId === "string" ? body.bedId.trim() : "";
      if (!bedId) return reply.code(400).send({ error: "Le nouveau lit est requis." });

      try {
        const stay = await getStay(request.params.id);
        if (!stay) return reply.code(404).send({ error: "Séjour en cours introuvable." });

        const newBed = await getBed(bedId);
        if (!newBed) return reply.code(404).send({ error: "Lit introuvable." });
        if (bedStatusOf(newBed) !== "U") return reply.code(409).send({ error: "Ce lit n'est pas libre." });

        const oldBedId = currentBedId(stay);
        const oldBed = oldBedId ? await getBed(oldBedId) : null;
        const now = new Date().toISOString();

        const updatedStay = {
          ...stay,
          location: [
            ...(stay.location ?? []).map((entry) =>
              entry.status === "active"
                ? { ...entry, status: "completed", period: { ...entry.period, end: now } }
                : entry,
            ),
            { location: { reference: `Location/${newBed.id}` }, status: "active", period: { start: now } },
          ],
        };

        await runTransaction([
          putStayEntry(updatedStay),
          putBedEntry(newBed, "O"),
          ...(oldBed ? [putBedEntry(oldBed, "H")] : []),
        ]);
        return reply.send({ ok: true });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
