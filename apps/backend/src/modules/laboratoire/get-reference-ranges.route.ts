import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { LAB_CATALOG } from "../../lib/lab-catalog.js";
import { type ReferenceRange, referenceFor } from "../../lib/lab-reference-ranges.js";
import { ageInMonths } from "../../lib/nutrition.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";

// Valeurs de référence proposées pour une demande d'examen, d'après l'âge et le sexe de l'enfant.
// Le technicien peut les modifier ; sans sexe ou âge connu, aucune valeur n'est proposée.
export async function getReferenceRangesRoute(app: FastifyInstance) {
  app.get(
    "/api/lab/requests/:id/reference-ranges",
    { preHandler: [authenticate, authorize("lab_tech")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const sr = await hapiClient.get<{ subject?: { reference?: string } }>(`/ServiceRequest/${id}`);
        const patientId = sr.subject?.reference?.split("/")[1];
        if (!patientId) return reply.send({ ranges: {} });
        const patient = await hapiClient.get<{ birthDate?: string; gender?: string }>(`/Patient/${patientId}`);
        const months = patient.birthDate ? ageInMonths(patient.birthDate, new Date().toISOString()) : null;
        const ranges: Record<string, ReferenceRange> = {};
        for (const entry of LAB_CATALOG) {
          const ref = referenceFor(entry.code, months, patient.gender ?? "unknown");
          if (ref) ranges[entry.code] = ref;
        }
        return reply.send({ ranges });
      } catch (error) {
        if (error instanceof HapiError) {
          const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
          return reply.code(statusCode).send({ error: error.statusCode === 404 ? "Demande d'examen introuvable." : error.message });
        }
        throw error;
      }
    },
  );
}
