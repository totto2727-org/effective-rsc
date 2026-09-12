import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import type { Plugin, PluginOption, UserConfig } from "vite";

const browserEntry = fileURLToPath(new URL("./vite/browser.ts", import.meta.url));

export type EffrontViteOptions = {
  /** RSC environment entry exporting the runtime's `{ fetch }` handler. */
  readonly rsc?: string;
  /** Application module available to the RSC entry as `effront/application-entry`. */
  readonly application?: string;
};

/**
 * Configures EFFRONT's RSC, SSR, and browser environments.
 *
 * This integration owns the RSC and React plugins. Consumers should only add their runtime plugin,
 * such as `@cloudflare/vite-plugin`, and must not register either React plugin a second time.
 */
export const effront = (options: EffrontViteOptions = {}): PluginOption[] => {
  const rscEntry = options.rsc ?? "./src/worker.ts";
  const application = options.application ?? "./src/application.tsx";
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
        ssr: fileURLToPath(new URL("./server/ssr.tsx", import.meta.url)),
      },
      serverHandler: false,
    }),
    applicationAlias,
  ];
};
