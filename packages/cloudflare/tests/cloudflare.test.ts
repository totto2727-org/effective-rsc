import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { resolveConfig } from "vite";
import type { UserConfig } from "vite";

import { effrontCloudflare } from "../src/index";
import { effront } from "@effront/vite";

const fixtureRoot = fileURLToPath(new URL("./fixtures/", import.meta.url));
const configPath = fileURLToPath(new URL("./fixtures/wrangler.json", import.meta.url));

const resolveViteConfig = (config: UserConfig) =>
  resolveConfig(
    {
      root: fixtureRoot,
      ...config,
    },
    "build",
    "production",
  );

const resolveCloudflareConfig = (config: UserConfig = {}) =>
  resolveViteConfig({
    ...config,
    plugins: [effront(), effrontCloudflare({ configPath })],
  });

const resolveCoreConfig = () => resolveViteConfig({ plugins: effront() });

const resolveCloudflareOnlyConfig = () =>
  resolveViteConfig({ plugins: effrontCloudflare({ configPath }) });

describe("effrontCloudflare", () => {
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

  it("registers the portable core exactly once alongside Cloudflare", async () => {
    const config = await resolveCloudflareConfig();
    const names = config.plugins.map(({ name }) => name);

    expect(names).toContain("vite-plugin-cloudflare");
    expect(names).toContain("effront:cloudflare-ssr-output");
    expect(names.filter((name) => name === "effront:application-entry")).toHaveLength(1);
  });

  it("keeps the core-only resolved Vite configuration free of Cloudflare plugins", async () => {
    const config = await resolveCoreConfig();
    const names = config.plugins.map(({ name }) => name);

    expect(names).toContain("effront:application-entry");
    expect(names).not.toContain("vite-plugin-cloudflare");
    expect(names).not.toContain("effront:cloudflare-ssr-output");
  });

  it("keeps the Cloudflare-only resolved Vite configuration free of portable core plugins", async () => {
    const config = await resolveCloudflareOnlyConfig();
    const names = config.plugins.map(({ name }) => name);

    expect(names).toContain("vite-plugin-cloudflare");
    expect(names).toContain("effront:cloudflare-ssr-output");
    expect(names).not.toContain("effront:application-entry");
  });
});
