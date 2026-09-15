import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(root, "tmp"), { recursive: true });
// Workers inherit the invocation's copy and port rather than allocating new resources.
const run = (process.env["EFFRONT_E2E_RUN_DIR"] ??= mkdtempSync(join(root, "tmp/run-")));
if (!process.env["EFFRONT_E2E_APP_ROOT"]) {
  process.env["EFFRONT_E2E_APP_ROOT"] = join(run, "app");
  cpSync(join(root, "fixture"), process.env["EFFRONT_E2E_APP_ROOT"], { recursive: true });
}
const port = (process.env["EFFRONT_E2E_PORT"] ??= String(
  await new Promise<number>((resolve, reject) => {
    const socket = createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      if (address === null || typeof address === "string") throw new Error("Expected a TCP port");
      socket.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  }),
));
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  outputDir: join(run, "test-results"),
  forbidOnly: true,
  workers: 1,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: origin, trace: "retain-on-failure" },
  webServer: {
    cwd: root,
    command: `vp build && wrangler dev --local --no-bundle --config ${JSON.stringify(join(run, "app/dist/rsc/wrangler.json"))} --env-file empty.env --ip 127.0.0.1 --port ${port} --inspector-port 0 --persist-to ${JSON.stringify(join(run, "state"))} --var "APP_LABEL:Workers override" --var "SERVER_TOKEN:acceptance-test-secret"`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
