import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { withLock } from "../../lib/keyed-lock.js";
import { isSafeId } from "../../lib/safe-id.js";
import { authenticate } from "../../socle/auth/authenticate.js";
import { authorize } from "../../socle/auth/authorize.js";
import { fromFhirAdministrations, toFhirAdministration } from "./administration.fhir.js";
import { getStay, hapiErrorReply } from "./stay-store.js";

interface Prescription {
  status?: string;
  subject?: { reference?: string };
  medicationCodeableConcept?: { text?: string };
}

// Délai sous lequel une même ordonnance ne peut pas être enregistrée deux fois (double clic).
const DUPLICATE_WINDOW_MS = 2 * 60_000;

// Enregistre qu'un médicament prescrit a été donné (ou non, avec le motif) à un patient hospitalisé.
export async function recordAdministrationRoute(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>(
    "/api/hospitalisations/:id/administrations",
    { preHandler: [authenticate, authorize("nurse")] },
    async (request, reply) => {
      const b = (request.body ?? {}) as Record<string, unknown>;
      const prescriptionId = b.prescriptionId;
      const note = typeof b.note === "string" ? b.note.trim() : "";
      if (!isSafeId(request.params.id) || !isSafeId(prescriptionId) || typeof b.given !== "boolean") {
        return reply.code(400).send({ error: "Requête invalide (ordonnance et indication « donné » requises)." });
      }
      if (!b.given && !note) return reply.code(400).send({ error: "Le motif est requis quand le médicament n'est pas donné." });
      if (note.length > 500) return reply.code(400).send({ error: "La note est trop longue (500 caractères maximum)." });

      try {
        const stay = await getStay(request.params.id);
        if (!stay) return reply.code(404).send({ error: "Séjour en cours introuvable." });
        const patientRef = stay.subject?.reference ?? "";

        let prescription: Prescription;
        try {
          prescription = await hapiClient.get<Prescription>(`/MedicationRequest/${prescriptionId}`);
        } catch (error) {
          if (error instanceof HapiError && error.statusCode === 404) return reply.code(404).send({ error: "Ordonnance introuvable." });
          throw error;
        }
        if (prescription.subject?.reference !== patientRef) {
          return reply.code(409).send({ error: "Cette ordonnance n'appartient pas au patient hospitalisé." });
        }
        if (prescription.status && prescription.status !== "active" && prescription.status !== "completed") {
          return reply.code(409).send({ error: "Cette ordonnance n'est plus active." });
        }

        return await withLock(`administration:${prescriptionId}`, async () => {
          const recent = await hapiClient.get<{ entry?: { resource: never }[] }>(
            `/MedicationAdministration?context=Encounter/${request.params.id}&request=MedicationRequest/${prescriptionId}&_sort=-effective-time&_count=1`,
            { "Cache-Control": "no-cache" },
          );
          const last = fromFhirAdministrations(recent)[0];
          if (last?.at && Date.now() - Date.parse(last.at) < DUPLICATE_WINDOW_MS) {
            return reply.code(409).send({ error: "Une administration vient d'être enregistrée pour cette ordonnance." });
          }
          const created = await hapiClient.post<{ id?: string }>(
            "/MedicationAdministration",
            toFhirAdministration({
              patientId: patientRef.split("/")[1] ?? "",
              stayId: request.params.id,
              prescriptionId,
              medication: prescription.medicationCodeableConcept?.text ?? "Médicament",
              given: b.given as boolean,
              note: note || undefined,
              performer: { id: request.user.sub, name: request.user.name },
              at: new Date().toISOString(),
            }),
          );
          return reply.code(201).send({ id: created.id });
        });
      } catch (error) {
        const failure = hapiErrorReply(error);
        if (failure) return reply.code(failure.code).send({ error: failure.error });
        throw error;
      }
    },
  );
}
