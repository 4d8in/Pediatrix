import { test, expect, type Page } from "@playwright/test";
import { e2ePassword, login } from "./fixtures";

async function admitPatient(page: Page, lastName: string): Promise<void> {
  await page.getByTestId("nav-admission").click();
  await page.getByTestId("admission-first-name").fill("E2E");
  await page.getByTestId("admission-last-name").fill(lastName);
  await page.getByTestId("admission-birth-date").fill("2019-02-03");
  await page.getByTestId("admission-guardian-name").fill("Tuteur E2E");
  await page.getByTestId("admission-guardian-relationship").selectOption("Mère");
  await page.getByTestId("admission-guardian-phone").fill("+221701234567");
  await page.getByTestId("admission-submit").click();
  await expect(page.getByText("Dossier créé")).toBeVisible();
}

// Serveur injoignable pendant le tri : la saisie est gardée sur le poste, puis envoyée une seule fois
// au retour du réseau (clé d'idempotence), et la file se vide.
test("hors ligne : un tri saisi sans réseau est mis en attente puis envoyé au retour", async ({ page }) => {
  const lastName = `Hors${Date.now()}`;
  await login(page, "infirmiere1", e2ePassword());
  await admitPatient(page, lastName);
  await page.getByTestId("nav-queue").click();
  const row = page.getByRole("row", { name: new RegExp(lastName) });
  await expect(row).toContainText("En attente");

  // Coupure : seules les requêtes de tri échouent comme si le serveur était injoignable.
  const sentWhileDown: string[] = [];
  await page.route("**/api/patients/*/triage", (route) => {
    sentWhileDown.push(route.request().method());
    return route.abort("connectionrefused");
  });

  await row.getByTestId("triage-emergency").click();
  await expect(page.getByTestId("outbox-banner")).toBeVisible();
  await expect(page.getByTestId("outbox-count")).toContainText("1");
  expect(sentWhileDown.length).toBeGreaterThan(0);

  // Retour du réseau : renvoi manuel.
  await page.unroute("**/api/patients/*/triage");
  await page.getByTestId("outbox-flush").click();
  await expect(page.getByTestId("outbox-banner")).toHaveCount(0, { timeout: 15_000 });

  // Le tri est bien enregistré (une fois), visible dans la file.
  await page.getByTestId("nav-queue").click();
  await expect(page.getByRole("row", { name: new RegExp(lastName) })).toContainText("Urgence");
});
