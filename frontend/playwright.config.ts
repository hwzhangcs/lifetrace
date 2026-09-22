import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8011",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
  ],
  webServer: {
    command:
      "../backend/.venv/bin/python -m uvicorn lifetrace.app:app --app-dir ../backend --host 127.0.0.1 --port 8011",
    url: "http://127.0.0.1:8011/api/health",
    reuseExistingServer: false,
    env: {
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        "postgresql+psycopg://lifetrace:lifetrace@localhost:54329/lifetrace_test_e2e",
    },
  },
});
