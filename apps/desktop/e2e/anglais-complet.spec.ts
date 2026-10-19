import { expect, test } from "@playwright/test";
import { e2ePassword } from "./fixtures";

// Parcourt les écrans de chaque rôle en anglais et cherche des mots français courants restés
// affichés (interface non traduite). Les données saisies (noms, motifs) ne sont pas en cause :
// on ne cherche que des mots d'interface.
const FRENCH_UI_WORDS =
  /\b(Enregistrer|Annuler|Valider|Chargement|Aucun[e]?|Actualiser|Rechercher|Déconnexion|Nouveau|Nouvelle|Imprimer|Fermer|Modifier|Supprimer|Ajouter|Patients?\s+du\s+jour|Erreur de|Se connecter|Mot de passe)\b/;

const ROLES = ["medecin1", "infirmiere1", "accueil1", "labo1", "pharmacien1", "caissier1", "directeur1", "admin1"];

for (const username of ROLES) {
  test(`${username} : écrans en anglais, sans mots d'interface français`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("pediatrix.lang", "en"));
    await page.goto("/");
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page.getByLabel("Password", { exact: true }).fill(e2ePassword());
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    const navIds = await page.locator('[data-testid^="nav-"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
    const leftovers: string[] = [];
    for (const id of navIds) {
      await page.getByTestId(id as string).click();
      await page.waitForTimeout(700);
      const text = await page.locator("body").innerText();
      const found = text.match(new RegExp(FRENCH_UI_WORDS.source, "g"));
      if (found) leftovers.push(`${id}: ${[...new Set(found)].join(", ")}`);
    }
    expect(leftovers, leftovers.join("\n")).toEqual([]);
  });
}
