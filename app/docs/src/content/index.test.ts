import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { getPage, navigation, pages } from "./index";

describe("documentation catalog", () => {
  it("keeps stable unique URLs and serializable navigation metadata", () => {
    expect(pages.length).toBe(13);
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

  it("keeps conceptual guides host-neutral and provides a complete host-specific quickstart", () => {
    const guides = pages.filter((page) => page.section === "Guide");
    expect(guides.length).toBe(6);
    for (const page of guides.filter((page) => page.slug !== "/guide/getting-started")) {
      const text = renderToStaticMarkup(page.content()).replace(/<[^>]*>/g, "");
      expect(`${page.title} ${page.description} ${text}`).not.toMatch(
        /Cloudflare|Workers|Wrangler|workerd|Vercel/,
      );
    }
    const gettingStarted = renderToStaticMarkup(
      getPage("/guide/getting-started").content(),
    ).replace(/<[^>]*>/g, "");
    expect(gettingStarted).toContain("vp add effront");
    expect(gettingStarted).toContain("effrontCloudflare()");
    expect(gettingStarted).toContain("createFetchHandler(application)");
    expect(gettingStarted).toContain("nodejs_compat");
    expect(gettingStarted).toContain("dist/rsc/wrangler.json");
    expect(gettingStarted).not.toContain("ではありません");
    expect(gettingStarted).not.toMatch(
      /vp install|チェックアウト|workspace依存|公開は前提にしません/,
    );
    expect(getPage("/platforms/cloudflare").section).toBe("Platforms");
    expect(renderToStaticMarkup(getPage("/platforms/cloudflare").content())).toContain(
      "wrangler.json",
    );
    expect(getPage("/").description).toBe(
      "Web標準とEffectベースで実装されたReactのメタフレームワークです。",
    );
  });

  it("separates platform support and consumer testing from host setup", () => {
    const text = (slug: string) =>
      renderToStaticMarkup(getPage(slug).content()).replace(/<[^>]*>/g, "");
    expect(text("/platforms")).toContain("Node、Bun、Vercel");
    expect(text("/platforms/cloudflare")).not.toMatch(/Node|Bun|Vercel|対応状況/);
    expect(text("/guide/testing")).not.toMatch(/scope|Flight|EOF|独立したE2E|実装の横/);
    expect(text("/guide/testing")).toContain("フォーム送信");
    for (const diagnostic of ["TS2769", "TS2345", "TS2322"]) {
      expect(text("/guide/effect")).toContain(diagnostic);
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
