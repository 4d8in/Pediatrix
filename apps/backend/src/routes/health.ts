import type { FastifyInstance } from "fastify";

const HAPI_FHIR_URL = process.env.HAPI_FHIR_URL ?? "http://localhost:8080/fhir";
const HAPI_TIMEOUT_MS = 3000;

interface CapabilityStatement {
  fhirVersion?: string;
}

interface HapiStatus {
  status: "up" | "down";
  fhirVersion: string | null;
}

// Interroge HAPI sur son CapabilityStatement pour vérifier qu'il répond
// et en extraire la version FHIR exposée. Ne lève jamais : une panne HAPI
// doit se traduire par un statut dégradé, pas par un backend qui plante.
async function checkHapi(): Promise<HapiStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HAPI_TIMEOUT_MS);

  try {
    const response = await fetch(`${HAPI_FHIR_URL}/metadata`, {
      signal: controller.signal,
      headers: { Accept: "application/fhir+json" },
    });

    if (!response.ok) {
      return { status: "down", fhirVersion: null };
    }

    const capabilityStatement = (await response.json()) as CapabilityStatement;
    return { status: "up", fhirVersion: capabilityStatement.fhirVersion ?? null };
  } catch {
    return { status: "down", fhirVersion: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function healthRoute(app: FastifyInstance) {
  app.get("/api/health", async () => {
    const hapi = await checkHapi();

    return {
      status: hapi.status === "up" ? "ok" : "degraded",
      backend: { status: "ok" as const },
      hapi,
    };
  });
}
