import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { effront } from "@effront/vite";
import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";

const exampleRoot = fileURLToPath(new URL("../../../examples/workers/", import.meta.url));
const temporaryRoot = fileURLToPath(new URL("../../../tmp/", import.meta.url));

// These are real listening Vite servers, filesystem watch events, module transforms,
// and outgoing HMR messages. Browser/workerd rendering lives in the acceptance suite.
describe("raw asset development updates", () => {
  let server: ViteDevServer | undefined;
  let directory: string | undefined;

  afterEach(async () => {
    await server?.close();
    if (directory)
      await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    vi.restoreAllMocks();
  });

  const serve = async (files: Readonly<Record<string, string>>) => {
    await mkdir(temporaryRoot, { recursive: true });
    const root = (directory = await mkdtemp(join(temporaryRoot, "raw-assets-test-")));
    for (const [name, content] of Object.entries(files)) await writeFile(join(root, name), content);
    const development = (server = await createServer({
      configFile: false,
      root: exampleRoot,
      cacheDir: join(root, "cache"),
      plugins: effront({ rsc: join(root, "entry.ts"), application: join(root, "entry.ts") }),
      server: { host: "127.0.0.1", port: 0, preTransformRequests: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    }));
    await development.listen();
    // Fixtures live outside the consumer root, whose files Vite normally watches.
    development.watcher.add(root);
    return {
      server: development,
      rsc: development.environments["rsc"]!,
      client: development.environments["client"]!,
      file: (name: string) => join(root, name),
      url: (name: string) => `/@fs${join(root, name)}`,
      async edit(name: string, content: string) {
        await expect.poll(() => development.watcher.getWatched()[root]).toContain(name);
        await writeFile(join(root, name), content);
      },
    };
  };

  it.each(["document.md", "template.txt"])(
    "updates %s imported as raw text without parsing its queryless watch dependency",
    async (name) => {
      const fixture = await serve({
        [name]: "# Initial text\n\nPlain text, not JavaScript.\n",
        "entry.ts": `export { default } from "./${name}?raw";\n`,
      });
      await fixture.rsc.transformRequest(fixture.url("entry.ts"));
      await fixture.rsc.transformRequest(`${fixture.url(name)}?raw`);
      const bare = fixture.rsc.moduleGraph.getModuleById(fixture.file(name));
      expect(bare?.type).toBe("js");
      expect([...bare!.importers].map(({ id }) => id)).toEqual([`${fixture.file(name)}?raw`]);
      const send = vi.spyOn(fixture.client.hot, "send");
      await fixture.edit(name, "# Updated text\n\nFresh raw contents.\n");
      await expect
        .poll(() => send.mock.calls.map(([payload]) => payload))
        .toContainEqual({
          type: "custom",
          event: "rsc:update",
          data: { file: fixture.file(name) },
        });
      expect(send.mock.calls.map(([payload]) => payload)).not.toContainEqual(
        expect.objectContaining({ type: "error" }),
      );
      const updated = await fixture.rsc.transformRequest(`${fixture.url(name)}?raw`);
      expect(updated?.code).toContain("Updated text");
      expect(updated?.code).toContain("Fresh raw contents.");
    },
  );

  it("removes a deleted raw glob entry without loading the missing file", async () => {
    const fixture = await serve({
      "kept.md": "# Kept page\n",
      "deleted.md": "# Deleted page\n",
      "entry.ts":
        'export const pages = import.meta.glob("./*.md", { eager: true, query: "?raw", import: "default" });\n',
    });
    await fixture.rsc.transformRequest(fixture.url("entry.ts"));
    await fixture.rsc.transformRequest(`${fixture.url("kept.md")}?raw`);
    await fixture.rsc.transformRequest(`${fixture.url("deleted.md")}?raw`);
    const send = vi.spyOn(fixture.client.hot, "send");
    await expect
      .poll(() => fixture.server.watcher.getWatched()[directory!])
      .toContain("deleted.md");
    await rm(fixture.file("deleted.md"));
    await expect
      .poll(() => send.mock.calls.map(([payload]) => payload))
      .toContainEqual({
        type: "custom",
        event: "rsc:update",
        data: { file: fixture.file("deleted.md") },
      });
    expect(send.mock.calls.map(([payload]) => payload)).not.toContainEqual(
      expect.objectContaining({ type: "error" }),
    );
    const updated = await fixture.rsc.transformRequest(fixture.url("entry.ts"));
    expect(updated?.code).toContain("kept.md");
    expect(updated?.code).not.toContain("deleted.md");
  });

  it("still transforms an independently loaded JavaScript module also imported as raw text", async () => {
    const fixture = await serve({
      "module.js": 'export const value = "initial";\n',
      "entry.ts": 'export { default } from "./module.js?raw";\n',
    });
    await fixture.rsc.transformRequest(fixture.url("entry.ts"));
    await fixture.rsc.transformRequest(`${fixture.url("module.js")}?raw`);
    await fixture.rsc.transformRequest(fixture.url("module.js"));
    const transform = vi.spyOn(fixture.rsc, "transformRequest");
    const send = vi.spyOn(fixture.client.hot, "send");
    await fixture.edit("module.js", 'export const value = "updated";\n');
    await expect
      .poll(() => send.mock.calls.map(([payload]) => payload))
      .toContainEqual({
        type: "custom",
        event: "rsc:update",
        data: { file: fixture.file("module.js") },
      });
    expect(transform.mock.calls.map(([url]) => url)).toContain(fixture.url("module.js"));
    const updated = await fixture.rsc.transformRequest(fixture.url("module.js"));
    expect(updated?.code).toContain('"updated"');
  });

  it("preserves syntax-error reporting for a real module that is also imported as raw text", async () => {
    const fixture = await serve({
      "module.js": 'export const value = "initial";\n',
      "entry.ts": 'export { default } from "./module.js?raw";\n',
    });
    await fixture.rsc.transformRequest(fixture.url("entry.ts"));
    await fixture.rsc.transformRequest(`${fixture.url("module.js")}?raw`);
    await fixture.rsc.transformRequest(fixture.url("module.js"));
    const send = vi.spyOn(fixture.client.hot, "send");
    await fixture.edit("module.js", "export const value = ;\n");
    await expect
      .poll(() => send.mock.calls.map(([payload]) => payload))
      .toContainEqual(expect.objectContaining({ type: "error" }));
  });

  it("preserves ordinary client CSS hot updates", async () => {
    const fixture = await serve({
      "style.css": ".example { color: red; }\n",
      "entry.ts": 'import "./style.css";\n',
    });
    await fixture.client.transformRequest(fixture.url("entry.ts"));
    await fixture.client.transformRequest(fixture.url("style.css"));
    const send = vi.spyOn(fixture.client.hot, "send");
    await fixture.edit("style.css", ".example { color: blue; }\n");
    await expect
      .poll(() => send.mock.calls.map(([payload]) => payload))
      .toContainEqual(
        expect.objectContaining({
          type: "update",
          updates: [expect.objectContaining({ type: "js-update", path: fixture.url("style.css") })],
        }),
      );
    const updated = await fixture.client.transformRequest(fixture.url("style.css"));
    expect(updated?.code).toContain("color: blue");
  });

  it("preserves ordinary image URL hot updates and serves changed asset bytes", async () => {
    const fixture = await serve({
      "diagram.svg": '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>',
      "entry.ts":
        'import image from "./diagram.svg?url"; export default image; import.meta.hot.accept();\n',
    });
    await fixture.client.transformRequest(fixture.url("entry.ts"));
    await fixture.client.transformRequest(`${fixture.url("diagram.svg")}?url`);
    const send = vi.spyOn(fixture.client.hot, "send");
    const changed = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="blue"/></svg>';
    await fixture.edit("diagram.svg", changed);
    await expect
      .poll(() => send.mock.calls.map(([payload]) => payload))
      .toContainEqual(
        expect.objectContaining({
          type: "update",
          updates: [expect.objectContaining({ type: "js-update" })],
        }),
      );
    const origin = fixture.server.resolvedUrls!.local[0]!;
    const response = await fetch(new URL(fixture.url("diagram.svg"), origin));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(changed);
  });
});
