const HAPI_FHIR_URL = process.env.HAPI_FHIR_URL ?? "http://localhost:8080/fhir";

// Erreur porteuse du statut HTTP renvoyé par HAPI, pour que les routes
// puissent la traduire en réponse propre sans jamais laisser fuir un 500 brut.
export class HapiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HapiError";
  }
}

interface OperationOutcome {
  issue?: { diagnostics?: string; details?: { text?: string } }[];
}

function extractMessage(body: unknown, fallback: string): string {
  const outcome = body as OperationOutcome | undefined;
  const issue = outcome?.issue?.[0];
  return issue?.diagnostics ?? issue?.details?.text ?? fallback;
}

async function hapiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${HAPI_FHIR_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/fhir+json",
        Accept: "application/fhir+json",
        ...init?.headers,
      },
    });
  } catch {
    throw new HapiError(502, "Le serveur FHIR (HAPI) est injoignable.");
  }

  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new HapiError(response.status, extractMessage(body, `HAPI a répondu ${response.status}.`));
  }

  return body as T;
}

export const hapiClient = {
  get: <T>(path: string, headers?: RequestInit["headers"]) => hapiFetch<T>(path, { headers }),
  post: <T>(path: string, resource: unknown) =>
    hapiFetch<T>(path, { method: "POST", body: JSON.stringify(resource) }),
  put: <T>(path: string, resource: unknown) =>
    hapiFetch<T>(path, { method: "PUT", body: JSON.stringify(resource) }),
};
