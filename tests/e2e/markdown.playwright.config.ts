import { mkdirSync, mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(root, "tmp"), { recursive: true });
// Test workers inherit the invocation's ports and artifacts instead of allocating another host.
const runDirectory = (process.env["EFFRONT_MARKDOWN_E2E_RUN_DIR"] ??= mkdtempSync(
  join(root, "tmp/markdown-run-"),
));
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
const ports = (process.env["EFFRONT_MARKDOWN_E2E_PORTS"] ??= (
  await Promise.all([freePort(), freePort()])
).join(",")).split(",");
const names = ["markdown-dev", "markdown-wrangler"] as const;
const viteConfig = JSON.stringify(join(root, "vite.markdown-host.config.ts"));
const emptyEnvironment = JSON.stringify(join(root, "fixtures/empty.env"));
const origin = (index: number) => `http://127.0.0.1:${ports[index]}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "markdown.e2e.ts",
  outputDir: join(runDirectory, "test-results"),
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: names.map((name, index) => {
    const output = join(runDirectory, name, "dist");
    const wranglerConfig = JSON.stringify(join(output, "rsc/wrangler.json"));
    const state = JSON.stringify(join(runDirectory, name, "state"));
    return {
      name,
      cwd: root,
      command:
        index === 0
          ? `vp dev --config ${viteConfig} --host 127.0.0.1 --port ${ports[index]} --strictPort`
          : `vp build --config ${viteConfig} && wrangler dev --local --no-bundle --config ${wranglerConfig} --env-file ${emptyEnvironment} --ip 127.0.0.1 --port ${ports[index]} --inspector-port 0 --persist-to ${state}`,
      env: { EFFRONT_MARKDOWN_E2E_OUTPUT: output },
      url: `${origin(index)}/manual`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM" as const, timeout: 5_000 },
    };
  }),
  projects: names.map((name, index) => ({
    name,
    use: { ...devices["Desktop Chrome"], baseURL: origin(index) },
  })),
});
