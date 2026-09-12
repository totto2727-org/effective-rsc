import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { erscCloudflare } from "effective-rsc/cloudflare";
import { defineConfig } from "vite-plus";

const outDir = process.env["ERSC_DOCS_E2E_OUTPUT"];
if (!outDir) throw new Error("ERSC_DOCS_E2E_OUTPUT is required by the docs E2E host configuration");

// Use the real docs source and public plugin, with test isolation and a client-bundle audit artifact.
export default defineConfig({
  root: fileURLToPath(new URL("../docs/", import.meta.url)),
  plugins: [
    tailwindcss(),
    erscCloudflare({ cloudflare: { inspectorPort: false, persistState: false } }),
    {
      name: "docs-acceptance-client-graph",
      applyToEnvironment: (environment) => environment.name === "client",
      generateBundle(_options, bundle) {
        const outputs = Object.values(bundle);
        this.emitFile({
          type: "asset",
          fileName: "acceptance-client-graph.json",
          source: JSON.stringify({
            modules: outputs.flatMap((output) =>
              output.type === "chunk" ? Object.keys(output.modules) : [],
            ),
            assets: outputs
              .filter((output) => output.type === "asset")
              .map((output) => output.fileName),
          }),
        });
      },
    },
  ],
  environments: {
    rsc: { build: { outDir: join(outDir, "rsc"), emptyOutDir: true } },
    ssr: { build: { outDir: join(outDir, "rsc/ssr"), emptyOutDir: true } },
    client: { build: { outDir: join(outDir, "client"), emptyOutDir: true } },
  },
});
