import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import type { EnvironmentModuleNode, Plugin, PluginOption, UserConfig } from "vite";

const browserEntry = fileURLToPath(new URL("./browser.ts", import.meta.url));

const rawQuery = /[?&]raw(?:&|$)/;

const rawAssetUpdates = (): Plugin => {
  const transformed = new WeakSet<EnvironmentModuleNode>();
  return {
    name: "effront:rsc-raw-assets",
    apply: "serve",
    applyToEnvironment: (environment) => environment.name === "rsc",
    transform(_code, id) {
      if (this.environment.mode !== "dev") return;
      const module = this.environment.moduleGraph.getModuleById(id);
      if (module) transformed.add(module);
    },
    hotUpdate: {
      order: "pre",
      handler({ file, modules, type, timestamp }) {
        if (
          type === "delete" &&
          modules.some((module) => module.file === file && module.id && rawQuery.test(module.id))
        ) {
          // Deleted files cannot be transformed. Refresh their live importers so
          // native import.meta.glob can enumerate the remaining files instead.
          const updates = new Set(modules.filter((module) => module.file !== file));
          const invalidated = new Set<EnvironmentModuleNode>();
          for (const module of modules) {
            if (module.file !== file) continue;
            for (const importer of module.importers) {
              if (importer.file !== file) updates.add(importer);
            }
            this.environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
          }
          return [...updates];
        }
        // Vite's ?raw loader adds a watch edge to the queryless file. That node is
        // not JavaScript, but plugin-rsc eagerly transforms every changed JS node.
        // Keep the real ?raw modules and any independently loaded queryless module.
        return modules.filter(
          (module) =>
            module.id !== file ||
            transformed.has(module) ||
            module.importers.size === 0 ||
            ![...module.importers].every(
              (importer) =>
                importer.file === file && importer.id !== null && rawQuery.test(importer.id),
            ),
        );
      },
    },
  };
};

export type EffrontViteOptions = {
  /** RSC environment entry exporting the runtime's `{ fetch }` handler; defaults to `src/entry.workers.ts`. */
  readonly rsc?: string;
  /** Application definition export available as `effront/application-entry`; defaults to `src/entry.client.ts`. */
  readonly application?: string;
};

/**
 * Configures EFFRONT's RSC, SSR, and browser environments.
 *
 * This integration owns the RSC and React plugins. Consumers should only add their runtime plugin,
 * such as `@cloudflare/vite-plugin`, and must not register either React plugin a second time.
 */
export const effront = (options: EffrontViteOptions = {}): PluginOption[] => {
  const rscEntry = options.rsc ?? "./src/entry.workers.ts";
  const application = options.application ?? "./src/entry.client.ts";
  const applicationAlias: Plugin = {
    name: "effront:application-entry",
    config: (config): UserConfig => ({
      resolve: {
        alias: {
          "effront/application-entry": resolve(config.root ?? process.cwd(), application),
        },
      },
    }),
  };

  return [
    rawAssetUpdates(),
    react({ compiler: true }),
    rsc({
      entries: {
        client: browserEntry,
        rsc: rscEntry,
        ssr: fileURLToPath(import.meta.resolve("effront/internal/ssr-entry")),
      },
      serverHandler: false,
    }),
    applicationAlias,
  ];
};
