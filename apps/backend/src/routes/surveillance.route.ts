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
function facilityOffsetMinutes(): number {
  const value = Number(process.env.FACILITY_UTC_OFFSET_MINUTES ?? 0);
  if (Number.isInteger(value) && Math.abs(value) <= 14 * 60) return value;
  console.warn("FACILITY_UTC_OFFSET_MINUTES invalide (entier de minutes attendu) : UTC utilisé.");
  return 0;
}

export async function surveillanceRoute(app: FastifyInstance) {
  app.get(
    "/api/surveillance/weekly",
    { preHandler: [authenticate, authorize("director", "doctor", "tech_admin")] },
    async (request, reply) => {
      const { week: requested } = request.query as { week?: string };
      // Les semaines suivent l'heure de l'établissement (décalage par rapport à l'UTC, en minutes).
      const offsetMs = facilityOffsetMinutes() * 60_000;
      const label = requested ?? isoWeekOf(new Date(Date.now() + offsetMs));
      const parsed = parseIsoWeek(label);
      if (!parsed) return reply.code(400).send({ error: "Semaine invalide (format AAAA-Sww, ex. 2026-W43)." });
      const week = { start: new Date(parsed.start.getTime() - offsetMs), end: new Date(parsed.end.getTime() - offsetMs) };

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

        // Diagnostics de la semaine sans code CIM-10 : invisibles pour la surveillance, signalés à l'écran.
        const uncoded = (resources as Condition[]).filter((r) => {
          if (r.resourceType !== "Condition" || !r.recordedDate) return false;
          const status = r.verificationStatus?.coding?.[0]?.code;
          if (status === "refuted" || status === "entered-in-error") return false;
          const at = Date.parse(r.recordedDate);
          const hasIcd = r.code?.coding?.some((coding) => coding.system?.includes("icd-10") && coding.code);
          return !hasIcd && at >= week.start.getTime() && at < week.end.getTime();
        }).length;

        const { rows, immediateCases } = weeklySurveillance(facts, week);
        return reply.send({
          week: label,
          from: week.start.toISOString(),
          to: week.end.toISOString(),
          rows,
          immediateCases,
          uncoded,
          utcOffsetMinutes: facilityOffsetMinutes(),
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
