import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { getPage, navigation, pages } from "./index";

describe("documentation catalog", () => {
  it("keeps stable unique URLs and serializable navigation metadata", () => {
    expect(pages.length).toBe(12);
    expect(new Set(pages.map((page) => page.slug)).size).toBe(pages.length);
    expect(JSON.parse(JSON.stringify(navigation))).toEqual(navigation);
    for (const page of pages) {
      expect(page.slug).toMatch(/^\/(?:[a-z-]+(?:\/[a-z-]+)*)?$/);
      expect(getPage(page.slug)).toBe(page);
      expect(navigation.find((item) => item.slug === page.slug)).toEqual({
        slug: page.slug,
        title: page.title,
        section: page.section,
      });
    }
  });

  it("rejects missing content instead of silently rendering another page", () => {
    expect(() => getPage("/not-a-document")).toThrow("Documentation route is missing content");
  });

  it.each(pages)("$slug exposes every table-of-contents target in rendered content", (page) => {
    const html = renderToStaticMarkup(page.content());
    expect(page.headings.length).toBeGreaterThan(0);
    expect(new Set(page.headings.map((heading) => heading.id)).size).toBe(page.headings.length);
    for (const heading of page.headings) {
      expect(heading.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(html).toContain(`id="${heading.id}"`);
    }
  });
});
