import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(root, "tmp"), { recursive: true });
// Test workers inherit these values rather than allocating another invocation.
const runDirectory = (process.env["EFFRONT_E2E_RUN_DIR"] ??= mkdtempSync(join(root, "tmp/run-")));
const fixture = join(root, "fixtures/app");
const buildApp = join(runDirectory, "build/app");
const devApp = join(runDirectory, "dev/app");
if (!process.env["EFFRONT_E2E_DEV_APP_ROOT"]) {
  cpSync(fixture, buildApp, { recursive: true });
  cpSync(fixture, devApp, { recursive: true });
  process.env["EFFRONT_E2E_DEV_APP_ROOT"] = devApp;
}
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const socket = createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      if (address === null || typeof address === "string") throw new Error("Expected a TCP port");
      socket.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
const buildPort = (process.env["EFFRONT_E2E_BUILD_PORT"] ??= String(await freePort()));
const devPort = (process.env["EFFRONT_E2E_DEV_PORT"] ??= String(await freePort()));
const buildOrigin = `http://127.0.0.1:${buildPort}`;
const devOrigin = `http://127.0.0.1:${devPort}`;
const output = join(buildApp, "dist");
const quote = JSON.stringify;
const viteConfig = quote(join(root, "vite.config.ts"));

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  outputDir: join(runDirectory, "test-results"),
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { trace: "retain-on-failure" },
  webServer: [
    {
      name: "build",
      cwd: root,
      command: `vp build --config ${viteConfig} && wrangler dev --local --no-bundle --config ${quote(join(output, "rsc/wrangler.json"))} --env-file ${quote(join(root, "fixtures/empty.env"))} --ip 127.0.0.1 --port ${buildPort} --inspector-port 0 --persist-to ${quote(join(runDirectory, "build/state"))} --var "APP_LABEL:Workers override" --var "SERVER_TOKEN:acceptance-test-secret"`,
      env: { EFFRONT_E2E_APP_ROOT: buildApp },
      url: buildOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    {
      name: "dev",
      cwd: root,
      command: `vp dev --config ${viteConfig} --host 127.0.0.1 --port ${devPort} --strictPort`,
      env: {
        EFFRONT_E2E_APP_ROOT: process.env["EFFRONT_E2E_DEV_APP_ROOT"],
      },
      url: devOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
  ],
  projects: [
    {
      name: "build",
      testIgnore: "**/dev.e2e.ts",
      use: { ...devices["Desktop Chrome"], baseURL: buildOrigin },
    },
    {
      name: "dev",
      testMatch: "**/dev.e2e.ts",
      use: { ...devices["Desktop Chrome"], baseURL: devOrigin },
    },
  ],
});
