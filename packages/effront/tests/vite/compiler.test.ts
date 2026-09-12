import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { effront } from "effront/vite";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const exampleRoot = fileURLToPath(new URL("../../../../examples/workers/", import.meta.url));
const temporaryRoot = fileURLToPath(new URL("../../../../tmp/", import.meta.url));
const memoSentinel = "react.memo_cache_sentinel";

// Exercise Vite's real module pipeline without executing server modules or substituting a host.
// Real workerd fetch/hydration acceptance remains in the independently managed browser suite.
describe("default native React Compiler", () => {
  let compiled: ViteDevServer;
  let uncompiled: ViteDevServer;
  let directory: string;

  beforeAll(async () => {
    await mkdir(temporaryRoot, { recursive: true });
    directory = await mkdtemp(join(temporaryRoot, "compiler-test-"));
    const common = {
      configFile: false as const,
      root: exampleRoot,
      server: {
        middlewareMode: true,
        hmr: false as const,
        ws: false as const,
        watch: null,
        preTransformRequests: false,
      },
    };
    compiled = await createServer({
      ...common,
      cacheDir: join(directory, "compiled"),
      plugins: effront(),
    });
    uncompiled = await createServer({
      ...common,
      cacheDir: join(directory, "uncompiled"),
      plugins: [react({ compiler: false })],
    });
  }, 30_000);

  afterAll(async () => {
    await Promise.all([compiled?.close(), uncompiled?.close()]);
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("memoizes the real example Counter by default, unlike a compiler-disabled control", async () => {
    const enabled = await compiled.environments["client"]!.transformRequest("/src/counter.tsx");
    const disabled = await uncompiled.environments["client"]!.transformRequest("/src/counter.tsx");

    expect(enabled?.code).toContain("compiler-runtime");
    expect(enabled?.code).toContain(memoSentinel);
    expect(enabled?.code).toMatch(/\$\[\d+\]/);
    expect(disabled?.code).toContain("Count:");
    expect(disabled?.code).not.toContain("compiler-runtime");
    expect(disabled?.code).not.toContain(memoSentinel);
  });

  it("keeps SSR and RSC outside client memoization and preserves React graph conditions", async () => {
    const client = compiled.environments["client"]!;
    expect(compiled.config.plugins.some(({ name }) => name.includes("cloudflare"))).toBe(false);
    const ssr = compiled.environments["ssr"]!;
    const rsc = compiled.environments["rsc"]!;
    expect(client.config.consumer).toBe("client");
    expect(ssr.config.consumer).toBe("server");
    expect(rsc.config.consumer).toBe("server");
    expect(client.config.resolve.conditions).not.toContain("react-server");
    expect(ssr.config.resolve.conditions).not.toContain("react-server");
    expect(rsc.config.resolve.conditions).toContain("react-server");

    const serverRendered = await ssr.transformRequest("/src/counter.tsx");
    const serverReference = await rsc.transformRequest("/src/counter.tsx");
    const serverApplication = await rsc.transformRequest("/src/application.tsx");
    expect(serverRendered?.code).toContain("Count:");
    expect(serverReference?.code).toContain("registerClientReference");
    expect(serverApplication?.code).toContain("React Server Components on Workers");
    for (const result of [serverRendered, serverReference, serverApplication]) {
      expect(result?.code).not.toContain("compiler-runtime");
      expect(result?.code).not.toContain(memoSentinel);
    }
  });
});
