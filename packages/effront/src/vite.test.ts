import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "vite";
import { describe, expect, it } from "vitest";
import { effront } from "./vite";

const root = fileURLToPath(new URL("../../../examples/workers/", import.meta.url));

describe("Effront entry conventions", () => {
  it("uses entry.server.ts and entry.client.ts without consumer configuration", async () => {
    const config = await resolveConfig({ configFile: false, root, plugins: effront() }, "build");

    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "./src/entry.server.ts",
    });
    expect(config.resolve.alias).toContainEqual({
      find: "effront/application-entry",
      replacement: resolve(root, "src/entry.client.ts"),
    });
  });

  it("preserves explicit host and application entry overrides relative to the consumer root", async () => {
    const config = await resolveConfig(
      {
        configFile: false,
        root,
        plugins: effront({ rsc: "./custom/host.ts", application: "./custom/app.tsx" }),
      },
      "build",
    );

    expect(config.environments["rsc"]?.build.rollupOptions.input).toEqual({
      index: "./custom/host.ts",
    });
    expect(config.resolve.alias).toContainEqual({
      find: "effront/application-entry",
      replacement: resolve(root, "custom/app.tsx"),
    });
  });
});
