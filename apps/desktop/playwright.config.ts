import { defineConfig, devices } from "@playwright/test";

// Cible l'UI web servie par Vite (localhost:1420), pas la coquille Electron.
// Suppose que HAPI FHIR + PostgreSQL (docker compose) et le backend Node
// (port 3001) tournent déjà — voir apps/desktop/e2e/README.md.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:1420",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
