import type { FastifyInstance } from "fastify";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { validateDischarge, withDischarge } from "../../lib/discharge.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { withLock } from "../../lib/keyed-lock.js";
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

      // Constater un décès est un acte médical, définitif : réservé au médecin.
      if (discharge.outcome === "deceased" && request.user.role !== "doctor") {
        return reply.code(403).send({ error: "Seul un médecin peut enregistrer un décès." });
      }

      try {
        return await withLock(`discharge:${request.params.id}`, async () => {
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

          const stayEntry = putStayEntry(finishedStay as typeof stay);
          const stayVersion = (stay as { meta?: { versionId?: string } }).meta?.versionId;
          if (stayVersion) (stayEntry.request as Record<string, unknown>).ifMatch = `W/"${stayVersion}"`;

          // Un décès marque aussi le patient (plus d'arrivée ni de rappel) dans la même transaction.
          const patientEntries: unknown[] = [];
          if (discharge.outcome === "deceased") {
            const patientId = stay.subject?.reference?.split("/")[1];
            if (!patientId) return reply.code(422).send({ error: "Séjour sans patient rattaché : le décès ne peut pas être enregistré." });
            const patient = await hapiClient.get<Record<string, unknown> & { meta?: { versionId?: string } }>(
              `/Patient/${encodeURIComponent(patientId)}`,
            );
            // La date de décès déjà enregistrée est conservée.
            const request_: Record<string, unknown> = { method: "PUT", url: `Patient/${patientId}` };
            if (patient.meta?.versionId) request_.ifMatch = `W/"${patient.meta.versionId}"`;
            patientEntries.push({
              resource: { ...patient, deceasedDateTime: (patient.deceasedDateTime as string | undefined) ?? now },
              request: request_,
            });
          }

          await runTransaction([stayEntry, ...(bed ? [putBedEntry(bed, "H")] : []), ...patientEntries]);
          return reply.send({ ok: true });
        });
      } catch (error) {
        if (error instanceof HapiError && error.statusCode === 412) {
          return reply.code(409).send({ error: "Le dossier a été modifié entre-temps : réessayez." });
        }
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
