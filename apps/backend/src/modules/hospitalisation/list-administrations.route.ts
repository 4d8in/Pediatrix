import type { FastifyInstance } from "fastify";
import { fetchAll } from "../../lib/fhir-search.js";
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
          `/MedicationAdministration?context=Encounter/${request.params.id}&_sort=-effective-time`,
          { "Cache-Control": "no-cache" },
        );
        const administrations = fromFhirAdministrations(bundle);

        // Échéancier des ordonnances actives avec un nombre de prises par jour, pour un séjour en cours.
        const schedule: { prescriptionId: string; nextDueAt: string; state: string }[] = [];
        const stay = await hapiClient.get<{ status?: string; subject?: { reference?: string }; period?: { start?: string } }>(
          `/Encounter/${request.params.id}`,
        );
        const patientId = stay.subject?.reference?.split("/")[1];
        if (stay.status === "in-progress" && patientId && isSafeId(patientId)) {
          // « active » = pas encore délivrée par la pharmacie ; « completed » = délivrée. Les ordonnances
          // arrêtées ou annulées sont exclues par la recherche.
          const requests = await fetchAll<{
            id: string;
            status?: string;
            authoredOn?: string;
            dosageInstruction?: { timing?: { repeat?: { frequency?: number } } }[];
          }>(`/MedicationRequest?patient=${patientId}&status=active,completed`);
          const stayStart = stay.period?.start ? Date.parse(stay.period.start) : 0;
          for (const rx of requests) {
            const perDay = rx.dosageInstruction?.[0]?.timing?.repeat?.frequency;
            if (!perDay || !rx.authoredOn || Date.parse(rx.authoredOn) < stayStart - 86_400_000) continue;
            // Pas d'alarme de retard tant que la pharmacie n'a pas délivré le médicament.
            if (rx.status === "active") {
              schedule.push({ prescriptionId: rx.id, nextDueAt: rx.authoredOn, state: "awaiting_pharmacy" });
              continue;
            }
            const lastGiven = administrations.find((a) => a.prescriptionId === rx.id && a.given)?.at ?? null;
            // L'ancre ne remonte jamais avant l'admission (ordonnance antérieure au séjour).
            const anchor = new Date(Math.max(Date.parse(rx.authoredOn), stayStart)).toISOString();
            const result = doseSchedule({ dosesPerDay: perDay, lastGivenAt: lastGiven, anchor });
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
