import { test, expect, type Page } from "@playwright/test";
import { e2ePassword, login, logout } from "./fixtures";

// Pré-requis en plus de ceux de parcours-clinique.spec.ts : les lits doivent
// exister (apps/backend : npx tsx src/scripts/seed-beds.ts).

async function admitPatient(page: Page, lastName: string, birthDate = "2019-02-03"): Promise<void> {
  await page.getByTestId("nav-admission").click();
  await page.getByTestId("admission-first-name").fill("E2E");
  await page.getByTestId("admission-last-name").fill(lastName);
  await page.getByTestId("admission-birth-date").fill(birthDate);
  await page.getByTestId("admission-guardian-name").fill("Tuteur E2E");
  await page.getByTestId("admission-guardian-relationship").selectOption("Mère");
  await page.getByTestId("admission-guardian-phone").fill("+221701234567");
  await page.getByTestId("admission-submit").click();
  await expect(page.getByText("Dossier créé")).toBeVisible();
}

test("file active : un patient admis aujourd'hui apparaît en attente", async ({ page }) => {
  const lastName = `File${Date.now()}`;
  await login(page, "infirmiere1", e2ePassword());
  await admitPatient(page, lastName);

  await page.getByTestId("nav-queue").click();
  await expect(page.getByRole("row", { name: new RegExp(lastName) })).toContainText("En attente");
});

test("lits : hospitaliser, faire sortir, puis remettre le lit en service", async ({ page }) => {
  const lastName = `Lit${Date.now()}`;
  await login(page, "infirmiere1", e2ePassword());
  await admitPatient(page, lastName);

  await page.getByTestId("nav-beds").click();
  const freeBed = page.getByRole("button", { name: /^[A-Z]{3}-\d{2}\s*Libre/ }).first();
  await expect(freeBed).toBeVisible();
  const bedName = ((await freeBed.textContent()) ?? "").match(/[A-Z]{3}-\d{2}/)?.[0] ?? "";
  expect(bedName).not.toBe("");
  await freeBed.click();

  // Hospitalisation dans le lit libre choisi.
  await page.getByTestId("patient-picker-search").fill(lastName);
  await page.getByRole("button", { name: new RegExp(lastName) }).click();
  await page.getByRole("button", { name: "Hospitaliser dans ce lit" }).click();
  const bedTile = page.getByRole("button", { name: new RegExp(`^${bedName}`) });
  await expect(bedTile).toContainText("Occupé");
  await expect(bedTile).toContainText(lastName);

  // Sortie : le lit passe en nettoyage.
  await page.getByTestId("discharge-open").click();
  await expect(page.getByTestId("discharge-confirm")).toBeDisabled(); // l'issue du séjour est obligatoire
  await page.getByTestId("discharge-outcome").selectOption("improved");
  await page.getByTestId("discharge-summary").fill("Évolution favorable, contrôle dans 7 jours.");
  await page.getByTestId("discharge-confirm").click();
  await expect(bedTile).toContainText("En nettoyage");

  // Remise en service pour laisser les données dans l'état initial.
  await bedTile.click();
  await page.getByRole("button", { name: "Marquer « Libre »" }).click();
  await expect(bedTile).toContainText("Libre");
});

test("naissance : l'infirmière saisit le registre, les alertes s'affichent, la saisie ne se refait pas", async ({ page }) => {
  const lastName = `Naiss${Date.now()}`;
  await login(page, "infirmiere1", e2ePassword());
  await admitPatient(page, lastName);

  await page.getByTestId("nav-record").click();
  await page.getByTestId("patient-picker-search").fill(lastName);
  await page.getByRole("button", { name: new RegExp(lastName) }).click();
  await page.getByRole("button", { name: "Naissance", exact: true }).click();
  await page.getByTestId("birth-weight").fill("2300");
  await page.getByTestId("birth-save").click();
  await expect(page.getByTestId("birth-record")).toContainText("Faible poids de naissance");
  await expect(page.getByTestId("birth-form")).toHaveCount(0);
});

test("PTME : inscription d'un nourrisson exposé puis résultat de dépistage", async ({ page }) => {
  const lastName = `Ptme${Date.now()}`;
  await login(page, "infirmiere1", e2ePassword());
  await admitPatient(page, lastName, new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10));

  await page.getByTestId("nav-record").click();
  await page.getByTestId("patient-picker-search").fill(lastName);
  await page.getByRole("button", { name: new RegExp(lastName) }).click();
  await page.getByRole("button", { name: "PTME", exact: true }).click();
  await page.getByTestId("pmtct-mother").selectOption("on_art");
  await page.getByTestId("pmtct-enrol").click();
  await expect(page.getByTestId("pmtct-record")).toContainText("Test virologique (PCR) à 6 semaines");
  await page.getByTestId("pmtct-negative-pcr_6w").click();
  await expect(page.getByTestId("pmtct-record")).toContainText("Négatif");
  await logout(page);

  // Le laboratoire ouvre le dossier mais ne voit pas l'onglet PTME (donnée très sensible).
  await login(page, "labo1", e2ePassword());
  await page.getByTestId("nav-record").click();
  await page.getByTestId("patient-picker-search").fill(lastName);
  await page.getByRole("button", { name: new RegExp(lastName) }).click();
  await expect(page.getByRole("button", { name: "Informations", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "PTME", exact: true })).toHaveCount(0);
});

test("comptes : un compte désactivé par l'admin ne peut plus se connecter", async ({ page }) => {
  const username = `e2e${Date.now()}`;
  const password = "motdepasse-e2e";
  await login(page, "admin1", e2ePassword());

  await page.getByTestId("nav-accounts").click();
  await page.getByPlaceholder("Identifiant (ex. infirmiere2)").fill(username);
  await page.getByPlaceholder("Nom affiché (ex. Fatou Ndiaye)").fill("Compte E2E");
  await page.getByLabel("Rôle", { exact: true }).selectOption("nurse");
  await page.getByPlaceholder("Mot de passe initial (8 caractères minimum)").fill(password);
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText(`Compte « ${username} » créé.`)).toBeVisible();

  await page.getByRole("row", { name: new RegExp(username) }).getByRole("button", { name: "Désactiver" }).click();
  await expect(page.getByRole("row", { name: new RegExp(username) })).toContainText("Désactivé");

  await logout(page);
  await page.getByLabel("Identifiant", { exact: true }).fill(username);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Compte désactivé")).toBeVisible();
});
