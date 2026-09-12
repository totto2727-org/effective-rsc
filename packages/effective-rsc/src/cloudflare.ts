import { join } from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import type { Plugin, PluginOption, UserConfig } from "vite";

import { ersc, type ErscViteOptions } from "./vite.ts";

/** Options for {@link erscCloudflare}. */
export interface ErscCloudflareOptions extends ErscViteOptions {
  /** Options forwarded unchanged to `@cloudflare/vite-plugin`, apart from its RSC environment wiring. */
  readonly cloudflare?: Omit<NonNullable<Parameters<typeof cloudflare>[0]>, "viteEnvironment">;
}

const rscEnvironment = { name: "rsc", childEnvironments: ["ssr"] };

const ssrOutputNesting = (): Plugin => ({
  name: "effective-rsc:cloudflare-ssr-output",
  enforce: "pre",
  config: (config): UserConfig | void => {
    if (config.environments?.["ssr"]?.build?.outDir !== undefined) return;

    const rootOutput = config.build?.outDir ?? "dist";
    const rscOutput = config.environments?.["rsc"]?.build?.outDir ?? join(rootOutput, "rsc");
    return { environments: { ssr: { build: { outDir: join(rscOutput, "ssr") } } } };
  },
});

/**
 * Configures ERSC for Cloudflare Workers.
 *
 * The Worker environment is always `rsc` with `ssr` as its child so that React Server Components
 * execute in workerd. By default, SSR output is nested beneath the RSC Worker output, allowing
 * Wrangler to include it as a Worker module. An explicit SSR `build.outDir` is preserved.
 * Other Cloudflare plugin options are forwarded unchanged.
 */
export const erscCloudflare = (options: ErscCloudflareOptions = {}): PluginOption[] => [
  ...ersc(options),
  ...cloudflare({ ...options.cloudflare, viteEnvironment: rscEnvironment }),
  ssrOutputNesting(),
];
