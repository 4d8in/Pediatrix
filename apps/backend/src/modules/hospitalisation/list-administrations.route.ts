import type { FastifyInstance } from "fastify";
import { hapiClient } from "../../lib/hapi-client.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fromFhirAdministrations } from "./administration.fhir.js";
import { doseSchedule } from "../../lib/administration-schedule.js";
import { hapiErrorReply } from "./stay-store.js";

// Administrations enregistrées pendant un séjour, de la plus récente à la plus ancienne.
export async function listAdministrationsRoute(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/hospitalisations/:id/administrations",
    { preHandler: [authenticate, authorize("nurse", "doctor")] },
    async (request, reply) => {
      if (!isSafeId(request.params.id)) return reply.code(404).send({ error: "Séjour introuvable." });
      try {
        const bundle = await hapiClient.get<{ entry?: { resource: never }[] }>(
          `/MedicationAdministration?context=Encounter/${request.params.id}&_sort=-effective-time&_count=200`,
          { "Cache-Control": "no-cache" },
        );
        const administrations = fromFhirAdministrations(bundle);

        // Échéancier des ordonnances actives avec un nombre de prises par jour, pour un séjour en cours.
        const schedule: { prescriptionId: string; nextDueAt: string; state: string }[] = [];
        const stay = await hapiClient.get<{ status?: string; subject?: { reference?: string }; period?: { start?: string } }>(
          `/Encounter/${request.params.id}`,
        );
        const patientId = stay.subject?.reference?.split("/")[1];
        if (stay.status === "in-progress" && patientId) {
          const requests = await hapiClient.get<{
            entry?: { resource: { id: string; authoredOn?: string; dosageInstruction?: { timing?: { repeat?: { frequency?: number } } }[] } }[];
          }>(`/MedicationRequest?patient=${patientId}&status=active&_count=100`, { "Cache-Control": "no-cache" });
          const stayStart = stay.period?.start ? Date.parse(stay.period.start) : 0;
          for (const { resource: rx } of requests.entry ?? []) {
            const perDay = rx.dosageInstruction?.[0]?.timing?.repeat?.frequency;
            if (!perDay || !rx.authoredOn || Date.parse(rx.authoredOn) < stayStart - 86_400_000) continue;
            const lastGiven = administrations.find((a) => a.prescriptionId === rx.id && a.given)?.at ?? null;
            const result = doseSchedule({ dosesPerDay: perDay, lastGivenAt: lastGiven, anchor: rx.authoredOn });
            if (result) schedule.push({ prescriptionId: rx.id, ...result });
          }
        }
        return reply.send({ administrations, schedule });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
