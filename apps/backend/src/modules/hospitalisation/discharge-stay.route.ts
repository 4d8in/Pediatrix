import type { FastifyInstance } from "fastify";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { validateDischarge, withDischarge } from "../../lib/discharge.js";
import { hapiClient } from "../../lib/hapi-client.js";
import { currentBedId } from "./beds.fhir.js";
import { getBed, getStay, hapiErrorReply, putBedEntry, putStayEntry, runTransaction } from "./stay-store.js";

// Sortie du patient : le séjour est terminé et le lit passe "en nettoyage".
export async function dischargeStayRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/hospitalisations/:id/discharge",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      const discharge = validateDischarge(request.body);
      if ("errors" in discharge) return reply.code(400).send({ error: "Requête invalide.", details: discharge.errors });

      try {
        const stay = await getStay(request.params.id);
        if (!stay) return reply.code(404).send({ error: "Séjour en cours introuvable." });

        const bedId = currentBedId(stay);
        const bed = bedId ? await getBed(bedId) : null;
        const now = new Date().toISOString();

        const finishedStay = {
          ...withDischarge(stay, discharge.outcome, discharge.summary),
          status: "finished",
          period: { ...stay.period, end: now },
          location: (stay.location ?? []).map((entry) =>
            entry.status === "active" ? { ...entry, status: "completed", period: { ...entry.period, end: now } } : entry,
          ),
        };

        // Un décès marque aussi le patient (plus d'arrivée ni de rappel) dans la même transaction.
        const patientEntries: unknown[] = [];
        if (discharge.outcome === "deceased") {
          const patientId = stay.subject?.reference?.split("/")[1];
          if (patientId) {
            const patient = await hapiClient.get<Record<string, unknown>>(`/Patient/${encodeURIComponent(patientId)}`);
            patientEntries.push({
              resource: { ...patient, deceasedDateTime: now },
              request: { method: "PUT", url: `Patient/${patientId}` },
            });
          }
        }

        await runTransaction([putStayEntry(finishedStay as typeof stay), ...(bed ? [putBedEntry(bed, "H")] : []), ...patientEntries]);
        return reply.send({ ok: true });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
