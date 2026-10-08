import { test, expect } from "@playwright/test";
import { e2ePassword, login } from "./fixtures";

test("login medecin1 réussi → accès à un écran autorisé", async ({ page }) => {
  await login(page, "medecin1", e2ePassword());

  // "Médecin" a accès à Consultations et Admission (voir NAV_ITEMS, App.tsx) :
  // on vérifie qu'un item réservé aux médecins est bien dans la nav.
  await expect(page.getByTestId("nav-consultations")).toBeVisible();
});

test("login avec mauvais mot de passe → erreur, pas d'accès", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Identifiant", { exact: true }).fill("medecin1");
  await page.getByLabel("Mot de passe", { exact: true }).fill("mot-de-passe-incorrect");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByText("Identifiant ou mot de passe incorrect.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Déconnexion" })).not.toBeVisible();
});
