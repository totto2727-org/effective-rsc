import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { erscCloudflare } from "effective-rsc/cloudflare";
import { defineConfig } from "vite-plus";

const outDir = process.env["ERSC_DOCS_E2E_OUTPUT"];
if (!outDir) throw new Error("ERSC_DOCS_E2E_OUTPUT is required by the docs E2E host configuration");

// Use the real docs source and public plugin, changing only test output/runtime isolation.
export default defineConfig({
  root: fileURLToPath(new URL("../docs/", import.meta.url)),
  plugins: [
    tailwindcss(),
    erscCloudflare({ cloudflare: { inspectorPort: false, persistState: false } }),
  ],
  environments: {
    rsc: { build: { outDir: join(outDir, "rsc"), emptyOutDir: true } },
    ssr: { build: { outDir: join(outDir, "rsc/ssr"), emptyOutDir: true } },
    client: { build: { outDir: join(outDir, "client"), emptyOutDir: true } },
  },
});
