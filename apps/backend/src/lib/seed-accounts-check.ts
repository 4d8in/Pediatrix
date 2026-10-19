import bcrypt from "bcryptjs";
import { listUsers } from "../socle/auth/user-store.js";

// Comptes de démonstration (mot de passe commun SEED_USER_PASSWORD) : en production, leur présence
// avec ce mot de passe est une faille évidente (identifiants prévisibles). Renvoie leurs identifiants.
export async function accountsWithSeedPassword(seedPassword: string | undefined): Promise<string[]> {
  if (!seedPassword) return [];
  const found: string[] = [];
  for (const { username, user } of await listUsers()) {
    if (!user.disabled && (await bcrypt.compare(seedPassword, user.passwordHash))) found.push(username);
  }
  return found;
}
