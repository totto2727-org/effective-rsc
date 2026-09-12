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
  plugins: [effront(), effrontCloudflare({ inspectorPort: false, persistState: false })],
  environments: {
    rsc: { build: { outDir: join(outDir, "rsc"), emptyOutDir: true } },
    ssr: { build: { outDir: join(outDir, "rsc/ssr"), emptyOutDir: true } },
    client: { build: { outDir: join(outDir, "client"), emptyOutDir: true } },
  },
});
