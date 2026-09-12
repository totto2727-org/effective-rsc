import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { resolveConfig } from "vite";
import type { Plugin, UserConfig } from "vite";

import { erscCloudflare } from "../../src/cloudflare";

const fixtureRoot = fileURLToPath(new URL("./fixtures/", import.meta.url));
const configPath = fileURLToPath(new URL("./fixtures/wrangler.json", import.meta.url));

const resolveCloudflareConfig = (config: UserConfig = {}) =>
  resolveConfig(
    {
      ...config,
      root: fixtureRoot,
      plugins: erscCloudflare({ cloudflare: { configPath } }),
    },
    "build",
    "production",
  );

describe("erscCloudflare", () => {
  it("resolves the invariant Cloudflare RSC environment with nested default SSR output", async () => {
    const config = await resolveCloudflareConfig();

    expect(config.environments["rsc"]).toBeDefined();
    expect(config.environments["ssr"]?.build.outDir).toBe(join(fixtureRoot, "dist/rsc/ssr"));
  });

  it("nests default SSR output under root and RSC output overrides", async () => {
    const rootOverride = await resolveCloudflareConfig({ build: { outDir: "worker-output" } });
    expect(rootOverride.environments["ssr"]?.build.outDir).toBe(
      join(fixtureRoot, "worker-output/rsc/ssr"),
    );

    const rscOverride = await resolveCloudflareConfig({
      build: { outDir: "worker-output" },
      environments: { rsc: { build: { outDir: "custom-rsc" } } },
    });
    expect(rscOverride.environments["ssr"]?.build.outDir).toBe(join(fixtureRoot, "custom-rsc/ssr"));
  });

  it("preserves an explicit SSR output override", async () => {
    const config = await resolveCloudflareConfig({
      environments: { ssr: { build: { outDir: "custom-ssr" } } },
    });

    expect(config.environments["ssr"]?.build.outDir).toBe(join(fixtureRoot, "custom-ssr"));
  });

  it("keeps React and RSC setup portable while adding the Cloudflare integration", () => {
    const plugins = erscCloudflare() as Plugin[];
    const pluginNames = (plugins.flat(Infinity) as Plugin[]).map(({ name }) => name);

    expect(pluginNames).toContain("effective-rsc:application-entry");
    expect(pluginNames).toContain("vite-plugin-cloudflare");
    expect(pluginNames).toContain("effective-rsc:cloudflare-ssr-output");
  });
});
