import "dotenv/config";
import bcrypt from "bcryptjs";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import { ROLE_CODE_SYSTEM, ROLE_LABELS, type Role } from "../socle/auth/roles.js";
import { upsertUser } from "../socle/auth/user-store.js";

// Identifie chaque Practitioner de façon stable, indépendamment de son id FHIR
// interne, pour permettre au script d'être ré-exécuté sans dupliquer les ressources.
const USERNAME_SYSTEM = "http://pediatrix.local/fhir/username";

interface SeedUser {
  username: string;
  displayName: string;
  role: Role;
}

const SEED_USERS: SeedUser[] = [
  { username: "infirmiere1", displayName: "Fatou Ndiaye", role: "nurse" },
  { username: "medecin1", displayName: "Dr. Awa Diallo", role: "doctor" },
  { username: "labo1", displayName: "Ibrahima Sarr", role: "lab_tech" },
  { username: "directeur1", displayName: "Cheikh Ba", role: "director" },
  { username: "admin1", displayName: "Admin Technique", role: "tech_admin" },
];

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

async function upsertPractitioner(user: SeedUser): Promise<string> {
  const id = practitionerId(user.username);

  await hapiClient.put(`/Practitioner/${id}`, {
    resourceType: "Practitioner",
    id,
    identifier: [{ system: USERNAME_SYSTEM, value: user.username }],
    name: [{ text: user.displayName }],
    active: true,
  });

  await hapiClient.put(`/PractitionerRole/${practitionerRoleId(user.username)}`, {
    resourceType: "PractitionerRole",
    id: practitionerRoleId(user.username),
    practitioner: { reference: `Practitioner/${id}` },
    code: [{ coding: [{ system: ROLE_CODE_SYSTEM, code: user.role, display: ROLE_LABELS[user.role] }] }],
    active: true,
  });

  return id;
}

async function seedUser(user: SeedUser, password: string): Promise<void> {
  const id = await upsertPractitioner(user);
  console.log(`  Practitioner/${id} + PractitionerRole à jour pour "${user.username}".`);

  const passwordHash = await bcrypt.hash(password, 10);
  await upsertUser(user.username, {
    passwordHash,
    practitionerId: id,
    role: user.role,
    displayName: user.displayName,
  });
}

async function main() {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.error('ÉCHEC : SEED_USER_PASSWORD est requis (voir apps/backend/.env.example).');
    process.exitCode = 1;
    return;
  }

  console.log(`Seed de ${SEED_USERS.length} utilisateurs de test...`);
  for (const user of SEED_USERS) {
    try {
      await seedUser(user, password);
    } catch (error) {
      const message = error instanceof HapiError ? error.message : String(error);
      console.error(`  ÉCHEC pour "${user.username}" : ${message}`);
      process.exitCode = 1;
    }
  }
  console.log("Terminé.");
}

await main();
