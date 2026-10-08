import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Role } from "./roles.js";

// Les identifiants (hash de mot de passe) ne sont jamais stockés dans HAPI :
// le port FHIR (8080) est exposé sur l'hôte sans authentification propre, donc
// tout ce qui y serait mis serait lisible par quiconque a accès au LAN, en
// contournant totalement ce backend.
const USERS_FILE = fileURLToPath(new URL("../../../data/users.json", import.meta.url));

export interface StoredUser {
  passwordHash: string;
  practitionerId: string;
  role: Role;
  displayName: string;
  // Compte désactivé par l'administrateur technique : la connexion est refusée.
  disabled?: boolean;
}

type UserStore = Record<string, StoredUser>;

async function readStore(): Promise<UserStore> {
  try {
    const raw = await readFile(USERS_FILE, "utf-8");
    return JSON.parse(raw) as UserStore;
  } catch {
    return {};
  }
}

export async function findUser(username: string): Promise<StoredUser | undefined> {
  const store = await readStore();
  return store[username];
}

export async function upsertUser(username: string, user: StoredUser): Promise<void> {
  const store = await readStore();
  store[username] = user;
  await mkdir(dirname(USERS_FILE), { recursive: true });
  await writeFile(USERS_FILE, JSON.stringify(store, null, 2));
}

// Retrouve un compte à partir de l'id Practitioner porté par le JWT (`sub`).
export async function findUserByPractitionerId(
  practitionerId: string,
): Promise<{ username: string; user: StoredUser } | undefined> {
  const store = await readStore();
  const entry = Object.entries(store).find(([, user]) => user.practitionerId === practitionerId);
  return entry ? { username: entry[0], user: entry[1] } : undefined;
}

export async function listUsers(): Promise<{ username: string; user: StoredUser }[]> {
  const store = await readStore();
  return Object.entries(store).map(([username, user]) => ({ username, user }));
}
