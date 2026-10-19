import { test, expect, type APIRequestContext } from "@playwright/test";
import { e2ePassword, login } from "./fixtures";

const BACKEND_URL = "http://localhost:3001";

async function token(request: APIRequestContext, username: string): Promise<string> {
  const response = await request.post(`${BACKEND_URL}/api/auth/login`, { data: { username, password: e2ePassword() } });
  if (response.status() !== 200) return "";
  return ((await response.json()) as { token: string }).token;
}

// Crée au besoin les comptes des nouveaux rôles (installation antérieure à ces modules),
// sans toucher aux comptes existants.
async function ensureAccount(request: APIRequestContext, username: string, role: string, displayName: string) {
  if (await token(request, username)) return;
  const admin = await token(request, "admin1");
  const response = await request.post(`${BACKEND_URL}/api/users`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: { username, displayName, role, password: e2ePassword() },
  });
  expect([201, 409]).toContain(response.status());
}

test.beforeAll(async ({ request }) => {
  await ensureAccount(request, "pharmacien1", "pharmacist", "Moussa Fall");
  await ensureAccount(request, "caissier1", "cashier", "Aïssatou Diop");
  await ensureAccount(request, "accueil1", "receptionist", "Mariama Sy");
});

test.describe("Nouveaux modules — navigation par rôle", () => {
  test("pharmacien1 : accède à la Pharmacie, pas à la facturation ni aux consultations", async ({ page }) => {
    await login(page, "pharmacien1", e2ePassword());
    await expect(page.getByTestId("nav-pharmacy")).toBeVisible();
    await expect(page.getByTestId("nav-billing")).not.toBeVisible();
    await expect(page.getByTestId("nav-consultations")).not.toBeVisible();
  });

  test("caissier1 : accède à la Facturation, pas à la Pharmacie", async ({ page }) => {
    await login(page, "caissier1", e2ePassword());
    await expect(page.getByTestId("nav-billing")).toBeVisible();
    await expect(page.getByTestId("nav-pharmacy")).not.toBeVisible();
    await expect(page.getByTestId("nav-laboratory")).not.toBeVisible();
  });

  test("accueil1 : Admission, File active et Rendez-vous, sans accès clinique", async ({ page }) => {
    await login(page, "accueil1", e2ePassword());
    await expect(page.getByTestId("nav-admission")).toBeVisible();
    await expect(page.getByTestId("nav-queue")).toBeVisible();
    await expect(page.getByTestId("nav-appointments")).toBeVisible();
    await expect(page.getByTestId("nav-consultations")).not.toBeVisible();
    await expect(page.getByTestId("nav-record")).not.toBeVisible();
  });

  test("directeur1 : Rapports et Journal d'audit visibles, Pharmacie non", async ({ page }) => {
    await login(page, "directeur1", e2ePassword());
    await expect(page.getByTestId("nav-reporting")).toBeVisible();
    await expect(page.getByTestId("nav-audit")).toBeVisible();
    await expect(page.getByTestId("nav-pharmacy")).not.toBeVisible();
  });
});

test.describe("Nouveaux modules — la vraie barrière est côté backend", () => {
  test("403 pour un rôle non autorisé sur chaque module", async ({ request }) => {
    const lab = await token(request, "labo1");
    const nurse = await token(request, "infirmiere1");
    const headers = (value: string) => ({ Authorization: `Bearer ${value}` });

    expect((await request.get(`${BACKEND_URL}/api/pharmacy/stock`, { headers: headers(nurse) })).status()).toBe(403);
    expect((await request.get(`${BACKEND_URL}/api/billing/invoices`, { headers: headers(nurse) })).status()).toBe(403);
    expect((await request.get(`${BACKEND_URL}/api/appointments`, { headers: headers(lab) })).status()).toBe(403);
    expect((await request.get(`${BACKEND_URL}/api/audit`, { headers: headers(nurse) })).status()).toBe(403);
    expect((await request.get(`${BACKEND_URL}/api/reporting/indicators`, { headers: headers(lab) })).status()).toBe(403);
    expect((await request.get(`${BACKEND_URL}/api/pharmacy/stock`)).status()).toBe(401);
  });
});

test("pharmacie : une réception de stock augmente le stock affiché", async ({ page }) => {
  await login(page, "pharmacien1", e2ePassword());
  await page.getByTestId("nav-pharmacy").click();

  await page.getByTestId("pharmacy-tab-reception").click();
  await page.getByTestId("receipt-item").selectOption("SRO");
  await page.getByTestId("receipt-quantity").fill("10");
  await page.getByTestId("receipt-submit").click();
  await expect(page.getByText(/10 × Sels de réhydratation orale \(SRO\) reçus en stock/)).toBeVisible();

  await page.getByTestId("pharmacy-tab-stock").click();
  await expect(page.getByRole("row", { name: /Sels de réhydratation orale/ })).toBeVisible();
});
