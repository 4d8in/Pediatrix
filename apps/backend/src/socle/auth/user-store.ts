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
