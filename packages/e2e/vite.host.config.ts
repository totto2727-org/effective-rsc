import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { erscCloudflare } from "effective-rsc/cloudflare";
import { defineConfig } from "vite-plus";

const outDir = process.env["ERSC_E2E_OUTPUT"];
if (!outDir) throw new Error("ERSC_E2E_OUTPUT is required by the E2E host configuration");

// The application stays in the example. Only test-host output and runtime isolation differ.
export default defineConfig({
  root: fileURLToPath(new URL("../../examples/workers/", import.meta.url)),
  plugins: [erscCloudflare({ cloudflare: { inspectorPort: false, persistState: false } })],
  environments: {
    rsc: { build: { outDir: join(outDir, "rsc"), emptyOutDir: true } },
    ssr: { build: { outDir: join(outDir, "rsc/ssr"), emptyOutDir: true } },
    client: { build: { outDir: join(outDir, "client"), emptyOutDir: true } },
  },
});
