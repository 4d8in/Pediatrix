// Journal d'audit : une ressource FHIR AuditEvent par accès notable (qui, quoi,
// quand, résultat). Sert à prouver à un hôpital, un patient ou l'autorité de
// protection des données qui a consulté ou modifié un dossier.
const REST_TYPE = { system: "http://terminology.hl7.org/CodeSystem/audit-event-type", code: "rest", display: "Restful Operation" };
const LOGIN_TYPE = { system: "http://dicom.nema.org/resources/ontology/DCM", code: "110114", display: "User Authentication" };

export type AuditAction = "C" | "R" | "U" | "D" | "E";
// Résultat FHIR : 0 succès, 4 échec côté demande (droits, validation), 8 échec grave.
export type AuditOutcome = "0" | "4" | "8";

export interface AuditInput {
  action: AuditAction;
  outcome: AuditOutcome;
  agent: { id?: string; name?: string; role?: string };
  ip?: string;
  entity?: string;
  description: string;
  login?: boolean;
}

const ACTION_BY_METHOD: Record<string, AuditAction> = { GET: "R", POST: "C", PUT: "U", PATCH: "U", DELETE: "D" };

export function actionForMethod(method: string): AuditAction {
  return ACTION_BY_METHOD[method.toUpperCase()] ?? "E";
}

export function outcomeForStatus(statusCode: number): AuditOutcome {
  if (statusCode < 400) return "0";
  return statusCode >= 500 ? "8" : "4";
}

// Quels appels journaliser ? Pas les rafraîchissements automatiques (listes sans
// identifiant) ni la lecture du journal elle-même ; oui à toute écriture, à toute
// lecture d'un dossier précis (route avec :id) et à tout refus de droits (403).
export function shouldAudit(method: string, routeUrl: string | undefined, statusCode: number, authenticated: boolean): boolean {
  if (!routeUrl || !routeUrl.startsWith("/api/")) return false;
  if (routeUrl === "/api/health" || routeUrl.startsWith("/api/audit") || routeUrl.startsWith("/api/auth/login")) return false;
  if (!authenticated) return false;
  if (statusCode === 403) return true;
  if (method.toUpperCase() !== "GET") return true;
  // Les recherches de patients (noms d'enfants) sont tracées aussi : qui, quand (jamais le terme cherché).
  return routeUrl.includes(":id") || routeUrl === "/api/patients";
}

export function patientIdFor(routeUrl: string | undefined, params: unknown, body: unknown): string | undefined {
  const id = (params as { id?: string } | undefined)?.id;
  if (routeUrl?.startsWith("/api/patients/:id") && id) return id;
  const bodyId = (body as { patientId?: unknown } | undefined)?.patientId;
  return typeof bodyId === "string" && bodyId ? bodyId : undefined;
}

export function toAuditEvent(input: AuditInput) {
  return {
    resourceType: "AuditEvent",
    type: input.login ? LOGIN_TYPE : REST_TYPE,
    action: input.action,
    recorded: new Date().toISOString(),
    outcome: input.outcome,
    agent: [
      {
        who: input.agent.id ? { reference: `Practitioner/${input.agent.id}`, display: input.agent.name } : { display: input.agent.name },
        requestor: true,
        role: input.agent.role ? [{ text: input.agent.role }] : undefined,
        network: input.ip ? { address: input.ip, type: "2" } : undefined,
      },
    ],
    source: { observer: { display: "Pédiatrix backend" } },
    entity: input.entity ? [{ what: { reference: input.entity }, description: input.description }] : undefined,
    outcomeDesc: input.entity ? undefined : input.description,
  };
}

interface FhirAuditEvent {
  id?: string;
  action?: string;
  recorded?: string;
  outcome?: string;
  type?: { code?: string };
  agent?: { who?: { reference?: string; display?: string }; role?: { text?: string }[]; network?: { address?: string } }[];
  entity?: { what?: { reference?: string }; description?: string }[];
  outcomeDesc?: string;
}

export interface AuditSummary {
  id: string;
  recorded: string | null;
  action: string;
  success: boolean;
  who: string;
  role: string | null;
  ip: string | null;
  patientId: string | null;
  description: string;
  login: boolean;
}

export function summarizeAuditEvent(event: FhirAuditEvent): AuditSummary {
  const agent = event.agent?.[0];
  const entity = event.entity?.[0];
  return {
    id: event.id ?? "",
    recorded: event.recorded ?? null,
    action: event.action ?? "E",
    success: event.outcome === "0",
    who: agent?.who?.display ?? "Inconnu",
    role: agent?.role?.[0]?.text ?? null,
    ip: agent?.network?.address ?? null,
    patientId: entity?.what?.reference?.startsWith("Patient/") ? entity.what.reference.split("/")[1] : null,
    description: entity?.description ?? event.outcomeDesc ?? "",
    login: event.type?.code === "110114",
  };
}
