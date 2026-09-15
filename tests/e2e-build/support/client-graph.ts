import type { Plugin } from "vite-plus";

export const acceptanceAudits = (): Plugin[] => [
  {
    name: "acceptance-client-graph",
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
  {
    name: "assert-runtime-package-boundary",
    generateBundle() {
      for (const id of this.getModuleIds()) {
        if (
          /\/packages\/cloudflare\/src\/index\.ts|\/node_modules\/(?:@cloudflare\/vite-plugin|vite|wrangler)\//.test(
            id,
          )
        ) {
          this.error(`Build tooling leaked into an application module graph: ${id}`);
        }
      }
    },
  },
];
