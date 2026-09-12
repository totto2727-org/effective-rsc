import { join } from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import type { Plugin, PluginOption, UserConfig } from "vite";

/** Options forwarded to `@cloudflare/vite-plugin`, apart from invariant RSC environment wiring. */
export type EffrontCloudflareOptions = Omit<
  NonNullable<Parameters<typeof cloudflare>[0]>,
  "viteEnvironment"
>;

const rscEnvironment = { name: "rsc", childEnvironments: ["ssr"] };

const ssrOutputNesting = (): Plugin => ({
  name: "effront:cloudflare-ssr-output",
  enforce: "pre",
  config: (config): UserConfig | void => {
    if (config.environments?.["ssr"]?.build?.outDir !== undefined) return;

    const rootOutput = config.build?.outDir ?? "dist";
    const rscOutput = config.environments?.["rsc"]?.build?.outDir ?? join(rootOutput, "rsc");
    return { environments: { ssr: { build: { outDir: join(rscOutput, "ssr") } } } };
  },
});

/**
 * Configures Cloudflare Workers integration for Effront.
 *
 * Register this alongside `effront()` so the core RSC, SSR, and browser environments remain portable.
 *
 * The Cloudflare Worker environment is always `rsc` with `ssr` as its child so React Server Components
 * execute in workerd. By default, SSR output is nested beneath the RSC Worker output, allowing
 * Wrangler to include it as a Worker module. An explicit SSR `build.outDir` is preserved.
 * Other Cloudflare plugin options are forwarded unchanged.
 */
export const effrontCloudflare = (options: EffrontCloudflareOptions = {}): PluginOption[] => [
  ...cloudflare({ ...options, viteEnvironment: rscEnvironment }),
  ssrOutputNesting(),
];
