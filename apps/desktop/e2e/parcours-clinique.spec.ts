import { test, expect } from "@playwright/test";
import { e2ePassword, login, logout } from "./fixtures";

// Flux bout-en-bout décrit dans CLAUDE.md :
// Admission → Consultation (Pédiatrie) → ServiceRequest → Laboratoire → DiagnosticReport → retour médecin.
// Données uniques (marqueur temporel) pour que le test soit rejouable sans collision.
test("parcours clinique complet : admission → consultation → labo → dossier patient", async ({ page }) => {
  const password = e2ePassword();
  const marker = Date.now().toString();
  const firstName = "E2E";
  const lastName = `Test${marker}`;
  const resultLabel = `E2E-Label-${marker}`;
  const resultValue = `E2E-Value-${marker}`;

  // 1. Login médecin
  await login(page, "medecin1", password);

  // 2. Admission : création du patient
  await page.getByTestId("nav-admission").click();
  await page.getByTestId("admission-first-name").fill(firstName);
  await page.getByTestId("admission-last-name").fill(lastName);
  await page.getByTestId("admission-birth-date").fill("2015-05-12");
  await page.getByTestId("admission-guardian-name").fill("Tuteur E2E");
  await page.getByTestId("admission-guardian-relationship").selectOption("Mère");
  await page.getByTestId("admission-guardian-phone").fill("+221701234567");
  await page.getByTestId("admission-submit").click();

  await expect(page.getByText("Dossier créé")).toBeVisible();

  // 3. Consultation : retrouver le patient et enregistrer la consultation
  await page.getByTestId("nav-consultations").click();
  await page.getByTestId("patient-picker-search").fill(lastName);
  await page.getByRole("button", { name: new RegExp(lastName) }).click();
  await page.getByPlaceholder("Ex. : fièvre persistante depuis 3 jours").fill("Contrôle de routine (test E2E)");
  // Le backend exige au moins un paramètre vital (create-encounter.route.ts).
  await page.getByTestId("vitals-temperature").fill("38.5");
  await page.getByRole("button", { name: "Enregistrer la consultation" }).click();

  await expect(page.getByText("Consultation enregistrée")).toBeVisible();

  // 4. Demande d'examen de laboratoire
  await page.getByTestId("exam-request-exam").fill("Numération Formule Sanguine");
  await page.getByTestId("exam-request-requester").fill("Dr. Awa Diallo");
  await page.getByRole("button", { name: "Envoyer au laboratoire" }).click();

  await expect(page.getByText("Examen demandé — le laboratoire a été notifié.")).toBeVisible();

  // 5. Déconnexion, login technicien labo
  await logout(page);
  await login(page, "labo1", password);

  // 6. Traiter la demande dans la file du laboratoire
  await page.getByTestId("nav-laboratory").click();
  await page.getByRole("button", { name: new RegExp(lastName) }).click();
  await page.getByTestId("lab-result-label-input").first().fill(resultLabel);
  await page.getByTestId("lab-result-value-input").first().fill(resultValue);
  await page.getByRole("button", { name: "Valider et envoyer" }).click();

  await expect(page.getByText("Résultats envoyés")).toBeVisible();

  // 7. Déconnexion, login médecin
  await logout(page);
  await login(page, "medecin1", password);

  // 8. Dossier patient : le résultat de laboratoire doit apparaître
  await page.getByTestId("nav-record").click();
  await page.getByTestId("patient-picker-search").fill(lastName);
  await page.getByRole("button", { name: new RegExp(lastName) }).click();

  await expect(page.getByText(`${resultLabel}: ${resultValue}`)).toBeVisible();
});
