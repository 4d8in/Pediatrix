import { test, expect } from "@playwright/test";
import { e2ePassword, login } from "./fixtures";

// Le backend n'est pas servi par le même serveur que le frontend (voir
// apps/desktop/src/lib/api.ts → BACKEND_URL) : les appels API directs de ce
// spec ciblent donc localhost:3001, pas le baseURL Playwright (localhost:1420).
const BACKEND_URL = "http://localhost:3001";

test.describe("Contrôle d'accès — niveau interface (masquage de nav)", () => {
  // Matrice de rôles lue directement dans App.tsx → NAV_ITEMS.
  test("labo1 (Technicien Labo) : nav restreinte à son rôle", async ({ page }) => {
    await login(page, "labo1", e2ePassword());

    await expect(page.getByTestId("nav-laboratory")).toBeVisible();
    await expect(page.getByTestId("nav-admission")).not.toBeVisible(); // nurse/doctor
    await expect(page.getByTestId("nav-stats")).not.toBeVisible(); // director
    await expect(page.getByTestId("nav-fhirLog")).not.toBeVisible(); // tech_admin
  });

  test("directeur1 (Directeur) : nav restreinte à son rôle", async ({ page }) => {
    await login(page, "directeur1", e2ePassword());

    await expect(page.getByTestId("nav-stats")).toBeVisible();
    await expect(page.getByTestId("nav-consultations")).not.toBeVisible(); // doctor
    await expect(page.getByTestId("nav-admission")).not.toBeVisible(); // nurse/doctor
  });
});

test.describe("Contrôle d'accès — niveau backend (la vraie barrière)", () => {
  // Prouve que la restriction n'est pas qu'un masquage d'écran : le backend
  // rejette l'appel indépendamment de l'UI (voir socle/auth/authorize.ts et
  // authenticate.ts, appliqués en preHandler sur POST /api/patients/:id/encounters,
  // réservé au rôle "doctor" — create-encounter.route.ts).
  test("403 si rôle insuffisant, 401 si token absent", async ({ request }) => {
    const loginResponse = await request.post(`${BACKEND_URL}/api/auth/login`, {
      data: { username: "labo1", password: e2ePassword() },
    });
    expect(loginResponse.status()).toBe(200);
    const { token } = (await loginResponse.json()) as { token: string };

    // authorize("doctor") répond 403 avant toute logique métier : l'id
    // patient n'a pas besoin d'exister pour vérifier le rejet du rôle.
    const forbiddenResponse = await request.post(`${BACKEND_URL}/api/patients/e2e-rbac-check/encounters`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { reason: "Test contrôle d'accès", vitals: { temperature: 38 } },
    });
    expect(forbiddenResponse.status()).toBe(403);

    const unauthenticatedResponse = await request.post(`${BACKEND_URL}/api/patients/e2e-rbac-check/encounters`, {
      data: { reason: "Test contrôle d'accès", vitals: { temperature: 38 } },
    });
    expect(unauthenticatedResponse.status()).toBe(401);
  });
});
