import "dotenv/config";
import bcrypt from "bcryptjs";
import { HapiError, hapiClient } from "../lib/hapi-client.js";
import type { Role } from "../socle/auth/roles.js";
import { upsertPractitioner } from "../socle/auth/practitioner.fhir.js";
import { upsertUser } from "../socle/auth/user-store.js";

interface SeedUser {
  username: string;
  displayName: string;
  role: Role;
}

const SEED_USERS: SeedUser[] = [
  { username: "infirmiere1", displayName: "Fatou Ndiaye", role: "nurse" },
  { username: "medecin1", displayName: "Dr. Awa Diallo", role: "doctor" },
  { username: "labo1", displayName: "Ibrahima Sarr", role: "lab_tech" },
  { username: "radiologue1", displayName: "Dr. Khadija Ndoye", role: "radiologist" },
  { username: "directeur1", displayName: "Cheikh Ba", role: "director" },
  { username: "admin1", displayName: "Admin Technique", role: "tech_admin" },
];

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
