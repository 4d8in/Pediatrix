import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import { getReadReportIds } from "../lib/read-store.js";
import { IMAGING_CATEGORY_CODE } from "../lib/service-category.js";
import { authenticate } from "../socle/auth/authenticate.js";
import { authorize } from "../socle/auth/authorize.js";

// Résultats reçus ces 7 derniers jours (laboratoire et imagerie), avec l'état
// « lu / non lu » propre au médecin connecté.

interface FhirBundle {
  entry?: { resource: FhirResource }[];
}

interface FhirResource {
  resourceType: string;
  id: string;
  code?: { text?: string };
  subject?: { reference?: string };
  issued?: string;
  conclusion?: string;
  category?: { coding?: { code?: string }[] }[];
  result?: { reference?: string }[];
  interpretation?: { coding?: { code?: string }[] }[];
  name?: { family?: string; given?: string[] }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function recentResultsRoute(app: FastifyInstance) {
  app.get("/api/results/recent", { preHandler: [authenticate, authorize("doctor")] }, async (request, reply) => {
    try {
      const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
      const [bundle, readIds] = await Promise.all([
        hapiClient.get<FhirBundle>(
          `/DiagnosticReport?issued=ge${since}&_sort=-issued&_include=DiagnosticReport:subject&_include=DiagnosticReport:result&_count=100`,
          { "Cache-Control": "no-cache" },
        ),
        getReadReportIds(request.user.sub),
      ]);

      const resources = (bundle.entry ?? []).map((entry) => entry.resource);
      const patients = new Map(
        resources
          .filter((resource) => resource.resourceType === "Patient")
          .map((patient) => {
            const name = patient.name?.[0];
            return [patient.id, [name?.given?.[0], name?.family].filter(Boolean).join(" ") || "Patient"];
          }),
      );

      // Observations porteuses d'une valeur critique (HH / LL), pour signaler les rapports concernés.
      const criticalObservations = new Set(
        resources
          .filter((r) => r.resourceType === "Observation")
          .filter((r) => r.interpretation?.some((i) => i.coding?.some((c) => c.code === "HH" || c.code === "LL")))
          .map((r) => r.id),
      );

      const results = resources
        .filter((resource) => resource.resourceType === "DiagnosticReport")
        .map((report) => {
          const patientId = report.subject?.reference?.replace("Patient/", "") ?? "";
          const isImaging = report.category?.some((cat) => cat.coding?.some((coding) => coding.code === IMAGING_CATEGORY_CODE));
          return {
            id: report.id,
            patientId,
            patientName: patients.get(patientId) ?? "Patient",
            exam: report.code?.text ?? "Examen",
            kind: isImaging ? "imagerie" : "laboratoire",
            issued: report.issued ?? null,
            conclusion: report.conclusion ?? null,
            read: readIds.has(report.id),
            critical: (report.result ?? []).some((ref) => criticalObservations.has(ref.reference?.split("/")[1] ?? "")),
          };
        })
        // Les résultats critiques non lus d'abord.
        .sort((a, b) => Number(b.critical && !b.read) - Number(a.critical && !a.read));

      return reply.send({ results });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
