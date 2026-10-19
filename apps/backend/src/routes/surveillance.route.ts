import type { FastifyInstance } from "fastify";
import { fetchAll } from "../lib/fhir-search.js";
import { HapiError } from "../lib/hapi-client.js";
import { type CaseFact, isoWeekOf, parseIsoWeek, weeklySurveillance } from "../lib/idsr.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";

type Json = Record<string, unknown>;

interface Condition {
  resourceType?: string;
  id?: string;
  code?: { coding?: { system?: string; code?: string }[] };
  verificationStatus?: { coding?: { code?: string }[] };
  subject?: { reference?: string };
  recordedDate?: string;
  birthDate?: string;
  gender?: string;
}

// Surveillance épidémiologique hebdomadaire : cas des maladies prioritaires par semaine ISO, avec la
// moyenne des 4 semaines précédentes et les alertes. Agrégats seulement : aucune identité de patient
// (les cas à déclaration immédiate donnent âge et sexe, pas de nom).
export async function surveillanceRoute(app: FastifyInstance) {
  app.get(
    "/api/surveillance/weekly",
    { preHandler: [authenticate, authorize("director", "doctor", "tech_admin")] },
    async (request, reply) => {
      const { week: requested } = request.query as { week?: string };
      const week = parseIsoWeek(requested ?? isoWeekOf(new Date()));
      if (!week) return reply.code(400).send({ error: "Semaine invalide (format AAAA-Sww, ex. 2026-W43)." });

      try {
        const since = new Date(week.start.getTime() - 4 * 7 * 86_400_000).toISOString();
        const resources = await fetchAll<Json>(
          `/Condition?recorded-date=ge${since}&recorded-date=lt${week.end.toISOString()}&_include=Condition:subject`,
        );
        const patients = new Map(
          (resources as Condition[])
            .filter((r) => r.resourceType === "Patient")
            .map((p) => [p.id ?? "", p]),
        );
        const facts: CaseFact[] = (resources as Condition[])
          .filter((r) => r.resourceType === "Condition")
          .flatMap((c) => {
            const icdCode = c.code?.coding?.find((coding) => coding.system?.includes("icd-10"))?.code;
            if (!icdCode || !c.recordedDate) return [];
            const status = c.verificationStatus?.coding?.[0]?.code;
            if (status === "refuted" || status === "entered-in-error") return [];
            const patient = patients.get(c.subject?.reference?.split("/")[1] ?? "");
            return [
              {
                patientId: c.subject?.reference?.split("/")[1],
                icdCode,
                recordedAt: c.recordedDate,
                confirmed: c.verificationStatus?.coding?.[0]?.code === "confirmed",
                birthDate: patient?.birthDate,
                sex: patient?.gender,
              },
            ];
          });

        const { rows, immediateCases } = weeklySurveillance(facts, week);
        return reply.send({
          week: requested ?? isoWeekOf(new Date()),
          from: week.start.toISOString(),
          to: week.end.toISOString(),
          rows,
          immediateCases,
        });
      } catch (error) {
        if (error instanceof HapiError) {
          return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
