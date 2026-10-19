import { expect, test } from "@playwright/test";

// La langue se choisit sur l'écran de connexion et est mémorisée.
test("interface en anglais : le sélecteur traduit l'écran de connexion et se mémorise", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Identifiant").first()).toBeVisible();

  await page.getByTestId("language-switch").selectOption("en");
  await expect(page.getByText("Username").first()).toBeVisible();
  await expect(page.getByText("Identifiant")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Username").first()).toBeVisible();

  await page.getByTestId("language-switch").selectOption("fr");
  await expect(page.getByText("Identifiant").first()).toBeVisible();
});
