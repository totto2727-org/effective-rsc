import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { corePages, coreSources } from "./core";

// Source is inspected only by tests. Production pages ship authored snippets, not filesystem reads.
describe("current core learning material", () => {
  it.each(coreSources)("keeps the $path excerpt identical to current implementation", (source) => {
    expect(source.path).toMatch(/^packages\/effront\/src\/[a-z0-9/.-]+\.tsx?$/);
    expect(source.code.length).toBeGreaterThan(60);
    const implementation = readFileSync(
      new URL(`../../../../${source.path}`, import.meta.url),
      "utf8",
    );
    expect(implementation).toContain(source.code);
  });

  it.each(corePages)("explains $slug with current source and navigable sections", (page) => {
    const html = renderToStaticMarkup(page.content());
    expect(html).toContain("data-core-source=");
    expect(html).not.toMatch(/data-reading-excerpt|data-baseline|data-comparison/);
    expect(page.section).toBe("Core");
    expect(page.headings.length).toBeGreaterThanOrEqual(3);
  });
});
