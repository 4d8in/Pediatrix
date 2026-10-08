import { expect, type Page } from "@playwright/test";

// Mot de passe commun aux comptes de démonstration créés par
// scripts/seed-users.sh (apps/backend/src/scripts/seed-users.ts), jamais codé
// en dur : voir apps/backend/.env (SEED_USER_PASSWORD).
export function e2ePassword(): string {
  const password = process.env.E2E_PASSWORD;
  if (!password) {
    throw new Error(
      "E2E_PASSWORD n'est pas défini. Lancer les tests avec " +
        "E2E_PASSWORD=<valeur de SEED_USER_PASSWORD dans apps/backend/.env> npx playwright test",
    );
  }
  return password;
}

export async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Identifiant", { exact: true }).fill(username);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("button", { name: "Déconnexion" })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
}
