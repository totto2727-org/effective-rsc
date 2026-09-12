import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import type { Plugin, PluginOption, UserConfig } from "vite";

const browserEntry = fileURLToPath(new URL("./browser.ts", import.meta.url));

export type EffrontViteOptions = {
  /** RSC environment entry exporting the runtime's `{ fetch }` handler; defaults to `src/entry.server.ts`. */
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
  const rscEntry = options.rsc ?? "./src/entry.server.ts";
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
