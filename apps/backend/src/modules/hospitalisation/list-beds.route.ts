import type { FastifyInstance } from "fastify";
import { hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import type { FhirLocation, FhirStay } from "./beds.fhir.js";
import { bedStatusOf, currentBedId } from "./beds.fhir.js";
import { hapiErrorReply } from "./stay-store.js";

interface FhirBundle {
  entry?: { resource: FhirLocation | FhirStay | FhirPatient }[];
}

interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: { family?: string; given?: string[] }[];
}

function isType(location: FhirLocation, code: string): boolean {
  return location.physicalType?.coding?.some((coding) => coding.code === code) ?? false;
}

// Services, lits et séjours en cours, en une seule réponse pour la page Gestion des lits.
export async function listBedsRoute(app: FastifyInstance) {
  app.get(
    "/api/beds",
    { preHandler: [authenticate, authorize("nurse", "doctor", "director", "tech_admin")] },
    async (_request, reply) => {
      try {
        const noCache = { "Cache-Control": "no-cache" };
        const [locationsBundle, staysBundle] = await Promise.all([
          hapiClient.get<FhirBundle>("/Location?_count=200", noCache),
          hapiClient.get<FhirBundle>(
            "/Encounter?class=IMP&status=in-progress&_include=Encounter:subject&_count=200",
            noCache,
          ),
        ]);

        const locations = (locationsBundle.entry ?? []).map((e) => e.resource as FhirLocation);
        const stayResources = (staysBundle.entry ?? []).map((e) => e.resource);
        const stays = stayResources.filter((r): r is FhirStay => r.resourceType === "Encounter");
        const patients = stayResources.filter((r): r is FhirPatient => r.resourceType === "Patient");

        const stayByBed = new Map<string, FhirStay>();
        for (const stay of stays) {
          const bedId = currentBedId(stay);
          if (bedId) stayByBed.set(bedId, stay);
        }

        function patientSummary(stay: FhirStay) {
          const patientId = stay.subject?.reference?.replace("Patient/", "") ?? "";
          const name = patients.find((p) => p.id === patientId)?.name?.[0];
          return {
            stayId: stay.id,
            patientId,
            patientName: [name?.given?.[0], name?.family].filter(Boolean).join(" ") || "Patient",
            since: stay.period?.start ?? null,
            reason: stay.reasonCode?.[0]?.text ?? null,
          };
        }

        const wards = locations
          .filter((location) => isType(location, "wa"))
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((ward) => ({
            id: ward.id,
            name: ward.name ?? ward.id,
            beds: locations
              .filter((location) => isType(location, "bd") && location.partOf?.reference === `Location/${ward.id}`)
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((bed) => {
                const stay = stayByBed.get(bed.id);
                return {
                  id: bed.id,
                  name: bed.name ?? bed.id,
                  status: bedStatusOf(bed),
                  stay: stay ? patientSummary(stay) : null,
                };
              }),
          }));

        return reply.send({ wards });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
