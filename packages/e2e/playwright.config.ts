import { defineConfig, devices } from "@playwright/test";

const devOrigin = "http://127.0.0.1:5174";
const wranglerOrigin = "http://127.0.0.1:8788";

export default defineConfig({
  testDir: "./tests",
  testMatch: "workers-fetch.e2e.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "workers-dev",
      use: { ...devices["Desktop Chrome"], baseURL: devOrigin },
    },
    {
      name: "workers-wrangler-default",
      use: { ...devices["Desktop Chrome"], baseURL: wranglerOrigin },
    },
    {
      name: "workers-wrangler-overridden",
      use: { ...devices["Desktop Chrome"], baseURL: wranglerOrigin },
    },
  ],
});
