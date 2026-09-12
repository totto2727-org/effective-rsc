import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

const outDir = process.env["EFFRONT_E2E_OUTPUT"];
if (!outDir) throw new Error("EFFRONT_E2E_OUTPUT is required by the E2E host configuration");

// The application stays in the example. Only test-host output and runtime isolation differ.
export default defineConfig({
  root: fileURLToPath(new URL("../../examples/workers/", import.meta.url)),
  plugins: [
    effront(),
    effrontCloudflare({ inspectorPort: false, persistState: false }),
    {
      name: "assert-runtime-package-boundary",
      generateBundle() {
        for (const id of this.getModuleIds()) {
          if (
            id.includes("/packages/cloudflare/src/index.ts") ||
            id.includes("/node_modules/@cloudflare/vite-plugin/") ||
            id.includes("/node_modules/vite/") ||
            id.includes("/node_modules/wrangler/")
          ) {
            this.error(`Build tooling leaked into an application module graph: ${id}`);
          }
        }
      },
    },
  ],
  environments: {
    rsc: { build: { outDir: join(outDir, "rsc"), emptyOutDir: true } },
    ssr: { build: { outDir: join(outDir, "rsc/ssr"), emptyOutDir: true } },
    client: { build: { outDir: join(outDir, "client"), emptyOutDir: true } },
  },
});
