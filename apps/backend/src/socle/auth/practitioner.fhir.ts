import { hapiClient } from "../../lib/hapi-client.js";
import { ROLE_CODE_SYSTEM, ROLE_LABELS, type Role } from "./roles.js";

// Identifie chaque Practitioner de façon stable, indépendamment de son id FHIR
// interne, pour permettre au script d'être ré-exécuté sans dupliquer les ressources.
const USERNAME_SYSTEM = "http://pediatrix.local/fhir/username";

// Id FHIR assignés par le client (plutôt que laissés à HAPI) : PUT sur un id
// déterministe est nativement idempotent ("update as create"), contrairement à
// un POST précédé d'une recherche par identifier — HAPI indexe la recherche par
// identifier de façon asynchrone, ce qui rend cette dernière approche non fiable
// juste après création (constaté en pratique : re-exécuter le script créait des
// doublons).
function practitionerId(username: string): string {
  return `seed-${username}`;
}

function practitionerRoleId(username: string): string {
  return `seed-role-${username}`;
}

export async function upsertPractitioner(user: { username: string; displayName: string; role: Role }, active = true): Promise<string> {
  const id = practitionerId(user.username);

  await hapiClient.put(`/Practitioner/${id}`, {
    resourceType: "Practitioner",
    id,
    identifier: [{ system: USERNAME_SYSTEM, value: user.username }],
    name: [{ text: user.displayName }],
    active,
  });

  await hapiClient.put(`/PractitionerRole/${practitionerRoleId(user.username)}`, {
    resourceType: "PractitionerRole",
    id: practitionerRoleId(user.username),
    practitioner: { reference: `Practitioner/${id}` },
    code: [{ coding: [{ system: ROLE_CODE_SYSTEM, code: user.role, display: ROLE_LABELS[user.role] }] }],
    active,
  });

  return id;
}

