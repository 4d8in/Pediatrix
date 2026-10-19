import type { FastifyInstance } from "fastify";
import { fetchAll } from "../../lib/fhir-search.js";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { VACCINE_SYSTEM, computeSchedule, loadSchedule } from "../../lib/vaccines.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

interface FhirImmunization {
  occurrenceDateTime?: string;
  vaccineCode?: { coding?: { system?: string; code?: string }[] };
}

// Calendrier vaccinal d'un enfant : chaque dose recommandée avec son état
// (faite, à faire, en retard, à venir) d'après les vaccins déjà enregistrés.
export async function vaccinationScheduleRoute(app: FastifyInstance) {
  app.get(
    "/api/patients/:id/vaccination-schedule",
    { preHandler: [authenticate, authorize("doctor", "nurse")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const [patient, immunizations, schedule] = await Promise.all([
          hapiClient.get<{ birthDate?: string }>(`/Patient/${id}`),
          fetchAll<FhirImmunization>(`/Immunization?patient=${id}`),
          loadSchedule(),
        ]);
        const recorded = immunizations.map((item) => ({
          code: item.vaccineCode?.coding?.find((c) => c.system === VACCINE_SYSTEM)?.code ?? null,
          date: item.occurrenceDateTime ?? null,
        }));
        return reply.send({ schedule: computeSchedule(patient.birthDate ?? "", recorded, schedule, new Date()) });
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({ error: error.statusCode === 404 ? "Patient introuvable." : error.message });
        }
        throw error;
      }
    },
  );
}
