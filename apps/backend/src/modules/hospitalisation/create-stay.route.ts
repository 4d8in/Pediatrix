import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { INPATIENT_CLASS, bedStatusOf } from "./beds.fhir.js";
import { getBed, hapiErrorReply, putBedEntry, runTransaction } from "./stay-store.js";

// Hospitaliser un patient dans un lit libre : création du séjour (Encounter IMP)
// et passage du lit à "occupé", dans la même transaction.
export async function createStayRoute(app: FastifyInstance) {
  app.post("/api/hospitalisations", { preHandler: [authenticate, authorize("nurse", "doctor")] }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const patientId = typeof body.patientId === "string" ? body.patientId.trim() : "";
    const bedId = typeof body.bedId === "string" ? body.bedId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!patientId || !bedId) {
      return reply.code(400).send({ error: "Le patient et le lit sont requis." });
    }

    try {
      try {
        await hapiClient.get(`/Patient/${encodeURIComponent(patientId)}`);
      } catch (error) {
        if (error instanceof HapiError && error.statusCode === 404) {
          return reply.code(404).send({ error: "Patient introuvable." });
        }
        throw error;
      }

      const bed = await getBed(bedId);
      if (!bed) return reply.code(404).send({ error: "Lit introuvable." });
      if (bedStatusOf(bed) !== "U") return reply.code(409).send({ error: "Ce lit n'est pas libre." });

      const alreadyHospitalised = await hapiClient.get<{ total?: number }>(
        `/Encounter?class=IMP&status=in-progress&patient=${encodeURIComponent(patientId)}&_summary=count`,
        { "Cache-Control": "no-cache" },
      );
      if ((alreadyHospitalised.total ?? 0) > 0) {
        return reply.code(409).send({ error: "Ce patient est déjà hospitalisé." });
      }

      const now = new Date().toISOString();
      await runTransaction([
        {
          fullUrl: `urn:uuid:${randomUUID()}`,
          resource: {
            resourceType: "Encounter",
            status: "in-progress",
            class: INPATIENT_CLASS,
            subject: { reference: `Patient/${patientId}` },
            participant: [{ individual: { reference: `Practitioner/${request.user.sub}` } }],
            reasonCode: reason ? [{ text: reason }] : undefined,
            period: { start: now },
            location: [{ location: { reference: `Location/${bed.id}` }, status: "active", period: { start: now } }],
          },
          request: { method: "POST", url: "Encounter" },
        },
        putBedEntry(bed, "O"),
      ]);
      return reply.code(201).send({ ok: true });
    } catch (error) {
      const failure = hapiErrorReply(error);
      if (failure) return reply.code(failure.code).send({ error: failure.error });
      throw error;
    }
  });
}
