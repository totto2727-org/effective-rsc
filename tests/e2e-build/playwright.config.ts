import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  forbidOnly: true,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      'vp build && wrangler dev --local --no-bundle --config fixture/dist/rsc/wrangler.json --env-file empty.env --ip 127.0.0.1 --port 4173 --inspector-port 0 --var "APP_LABEL:Workers override" --var "SERVER_TOKEN:acceptance-test-secret"',
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
