import type { FastifyInstance } from "fastify";
import { HapiError, hapiClient } from "../../lib/hapi-client.js";
import { VITAL_LOINC_CODES, type VitalKey } from "../../lib/vitals-codes.js";
import { parseEncounterTransactionResponse, toEncounterTransactionBundle } from "./encounter.fhir.js";
import type { CreateEncounterInput } from "./encounter.types.js";

const VITAL_KEYS = Object.keys(VITAL_LOINC_CODES) as VitalKey[];

function validate(body: unknown): { input: CreateEncounterInput } | { errors: string[] } {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const rawVitals = (b.vitals ?? {}) as Record<string, unknown>;

  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  const notes = typeof b.notes === "string" ? b.notes.trim() : "";

  if (!reason) errors.push("Le motif de consultation est requis.");

  const vitals: CreateEncounterInput["vitals"] = {};
  for (const key of VITAL_KEYS) {
    const raw = rawVitals[key];
    if (raw === undefined || raw === null || raw === "") continue;

    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      errors.push(`Le paramètre "${key}" doit être un nombre positif.`);
      continue;
    }
    vitals[key] = value;
  }

  if (Object.keys(vitals).length === 0) {
    errors.push("Au moins un paramètre vital est requis.");
  }

  if (errors.length > 0) return { errors };

  return { input: { reason, notes: notes || undefined, vitals } };
}

interface TransactionResponseBundle {
  entry?: { response?: { location?: string } }[];
}

export async function createEncounterRoute(app: FastifyInstance) {
  app.post("/api/patients/:id/encounters", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await hapiClient.get(`/Patient/${id}`);
    } catch (error) {
      if (error instanceof HapiError) {
        const statusCode = error.statusCode === 404 ? 404 : error.statusCode >= 500 ? 502 : error.statusCode;
        const message = error.statusCode === 404 ? "Patient introuvable." : error.message;
        return reply.code(statusCode).send({ error: message });
      }
      throw error;
    }

    const result = validate(request.body);
    if ("errors" in result) {
      return reply.code(400).send({ error: "Requête invalide.", details: result.errors });
    }

    try {
      const responseBundle = await hapiClient.post<TransactionResponseBundle>(
        "",
        toEncounterTransactionBundle(id, result.input),
      );
      const { encounterId } = parseEncounterTransactionResponse(responseBundle);
      return reply.code(201).send({ encounterId });
    } catch (error) {
      if (error instanceof HapiError) {
        return reply.code(error.statusCode >= 500 ? 502 : error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
