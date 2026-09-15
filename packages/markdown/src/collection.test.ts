import { describe, expect, it } from "vite-plus/test";
import { createMarkdownCollection } from "./collection.ts";

const collection = () =>
  createMarkdownCollection({
    source: "./content",
    basePath: "/manual",
    documents: {
      "./content/README.md": "# Read me",
      "./content/index.md": "# Manual",
      "./content/guides/index.md": "# Guides",
      "./content/guides/advanced.md": "# Advanced",
      "./content/guides/getting started.md": "# Getting started",
      "./content/guides/100%.md": "# Percent",
      "./content/guides/$&+,=@.md": "# Punctuation",
    },
    assets: {
      "./content/guides/diagram one.svg": "/assets/diagram-one.a1b2.svg",
      "./content/logo.svg": "/assets/logo.c3d4.svg",
    },
  });

describe("createMarkdownCollection", () => {
  it("maps nested documents to public routes without README magic", () => {
    const markdown = collection();

    expect(markdown.entries.map((entry) => [entry.source, entry.pathname, entry.url])).toEqual([
      ["./content/index.md", "/manual", "/manual"],
      ["./content/guides/index.md", "/manual/guides", "/manual/guides"],
      [
        "./content/guides/$&+,=@.md",
        "/manual/guides/%24%26%2B%2C%3D%40",
        "/manual/guides/%24%26%2B%2C%3D%40",
      ],
      ["./content/guides/100%.md", "/manual/guides/100%25", "/manual/guides/100%25"],
      ["./content/guides/advanced.md", "/manual/guides/advanced", "/manual/guides/advanced"],
      [
        "./content/guides/getting started.md",
        "/manual/guides/getting%20started",
        "/manual/guides/getting%20started",
      ],
      ["./content/README.md", "/manual/README", "/manual/README"],
    ]);
    expect(markdown.get("/manual/guides/getting%20started")?.content).toBe("# Getting started");
    expect(markdown.get("/manual/guides/getting started")).toBe(
      markdown.get("/manual/guides/getting%20started"),
    );
    expect(markdown.get("/manual/guides/100%25")?.content).toBe("# Percent");
    expect(markdown.get("/manual/guides/%24%26%2B%2C%3D%40")?.url).toBe(
      "/manual/guides/%24%26%2B%2C%3D%40",
    );
    expect(markdown.get("/outside")).toBeUndefined();
  });

  it("looks up URL-encoded filenames without interpreting them as route patterns", () => {
    const markdown = createMarkdownCollection({
      source: "./content",
      basePath: "/manual",
      documents: {
        "./content/literal%20.md": "# Literal escape",
        "./content/what?.md": "# Question",
        "./content/hash#.md": "# Hash",
        "./content/:name.md": "# Colon",
      },
    });
    expect(markdown.get("/manual/literal%2520")?.content).toBe("# Literal escape");
    expect(markdown.get("/manual/literal%20")).toBeUndefined();
    expect(markdown.get("/manual/what%3F")?.content).toBe("# Question");
    expect(markdown.get("/manual/hash%23")?.content).toBe("# Hash");
    expect(markdown.get("/manual/%3Aname")?.content).toBe("# Colon");
  });

  it.each([
    "/manual/guides%2Fadvanced",
    "/manual/guides%2fadvanced",
    "/manual/guides%5Cadvanced",
    "/manual/guides\\advanced",
    "/manual/guides/advanced%00",
    "/manual/guides/advanced\0",
    "/manual/guides/%2E/advanced",
    "/manual/guides/./advanced",
    "/manual/guides/%2E%2E",
    "/manual/guides/../guides/advanced",
    "/manual//guides/advanced",
    "//manual/guides/advanced",
    "/manual/guides/advanced//",
    "/manual//",
    "/manual/guides/%",
    "/manual/guides/%E0%A4",
  ])("returns undefined for an unknown pathname without throwing: %s", (pathname) => {
    expect(collection().get(pathname)).toBeUndefined();
  });

  it.each(["/manual/", "/manual/guides/", "/manual/guides/advanced/"])(
    "preserves a single trailing slash alias: %s",
    (pathname) => {
      const markdown = collection();
      expect(markdown.get(pathname)).toBe(markdown.get(pathname.slice(0, -1)));
      expect(markdown.get(pathname)).toBeDefined();
    },
  );

  it.each(["/", "/?mode=full#top"])("looks up a root index: %s", (pathname) => {
    const markdown = createMarkdownCollection({
      source: "./content",
      basePath: "/",
      documents: { "./content/index.md": "# Root" },
    });
    expect(markdown.get(pathname)?.content).toBe("# Root");
  });

  it.each(["//", "///", "/./", "/%2E/", "/%00", "/%2F"])(
    "does not alias unknown paths to a root index: %s",
    (pathname) => {
      const markdown = createMarkdownCollection({
        source: "./content",
        basePath: "/",
        documents: { "./content/index.md": "# Root" },
      });
      expect(markdown.get(pathname)).toBeUndefined();
    },
  );

  it.each(["%2F", "%5C", "%00", "%2E", "%", "%E0%A4"])(
    "looks up a literal escape filename after decoding once: %s",
    (filename) => {
      const markdown = createMarkdownCollection({
        source: "./content",
        basePath: "/manual",
        documents: { [`./content/${filename}.md`]: "# Literal escape" },
      });
      expect(markdown.get(`/manual/${encodeURIComponent(filename)}`)?.content).toBe(
        "# Literal escape",
      );
    },
  );

  it.each(["%2F", "%5C", "%00"])(
    "keeps encoded separator and NUL validation for content references: %s",
    (segment) => {
      const entry = collection().get("/manual/guides/advanced")!;
      // Links and images share the local-reference validation contract.
      expect(() => entry.resolveLink(`${segment}.md`)).toThrow(/invalid path segment/u);
      expect(() => entry.resolveImage(`${segment}.svg`)).toThrow(/invalid path segment/u);
    },
  );

  it("resolves Markdown relative to its source directory and preserves suffixes", () => {
    const markdown = collection();
    const entry = markdown.get("/manual/guides/advanced");
    expect(entry).toBeDefined();

    expect(entry?.resolveLink("index.md?mode=full#top")).toBe("/manual/guides?mode=full#top");
    expect(markdown.resolveLink(entry!, "getting%20started.md#install")).toBe(
      "/manual/guides/getting%20started#install",
    );
    expect(entry?.resolveLink("100%25.md")).toBe("/manual/guides/100%25");
    expect(entry?.resolveLink("?tab=examples#heading")).toBe(
      "/manual/guides/advanced?tab=examples#heading",
    );
    expect(entry?.resolveLink("#heading")).toBe("#heading");
  });

  it("resolves eager Vite asset URLs for links and images", () => {
    const markdown = collection();
    const entry = markdown.get("/manual/guides/advanced");
    expect(entry).toBeDefined();

    expect(entry?.resolveImage("diagram%20one.svg#icon")).toBe("/assets/diagram-one.a1b2.svg#icon");
    expect(markdown.resolveLink(entry!, "../logo.svg?download=1")).toBe(
      "/assets/logo.c3d4.svg?download=1",
    );
  });

  it("leaves external, site-absolute, and hash-only references untouched", () => {
    const markdown = collection();
    const entry = markdown.get("/manual/guides/advanced");
    expect(entry).toBeDefined();

    for (const href of [
      "https://example.com/docs?q=1#top",
      "mailto:hello@example.com",
      "/assets/global.svg",
      "//cdn.example.com/logo.svg",
      "#details",
    ]) {
      expect(entry?.resolveLink(href)).toBe(href);
    }
  });

  it("rejects invalid static maps and unsafe or unresolved local references", () => {
    expect(() =>
      createMarkdownCollection({
        source: "./content",
        basePath: "/manual",
        documents: { "./content/foo.md": "", "./content/foo/index.md": "" },
      }),
    ).toThrow(/same public pathname/u);
    expect(() =>
      createMarkdownCollection({
        source: "./content",
        basePath: "/manual",
        documents: { "./elsewhere/page.md": "" },
      }),
    ).toThrow(/outside source/u);

    const entry = collection().get("/manual/guides/advanced");
    expect(entry).toBeDefined();
    expect(() => entry?.resolveLink("missing.md")).toThrow(/imported Markdown/u);
    expect(() => entry?.resolveImage("missing.svg")).toThrow(/imported local asset/u);
    expect(() => entry?.resolveLink("../../../outside.md")).toThrow(/outside source/u);
    expect(() => entry?.resolveLink("javascript:alert(1)")).toThrow(/unsafe javascript/u);
    expect(() => entry?.resolveLink("java\nscript:alert(1)")).toThrow(/control characters/u);
    expect(() => entry?.resolveImage("data:image/svg+xml,unsafe")).toThrow(/unsafe data/u);
  });

  it("does not create ambiguous URLs when an imported asset already has a query or fragment", () => {
    const markdown = createMarkdownCollection({
      source: "./content",
      basePath: "/manual",
      documents: { "./content/index.md": "# Manual" },
      assets: { "./content/logo.svg": "/assets/logo.svg?compiled=1" },
    });
    const entry = markdown.get("/manual");
    expect(entry).toBeDefined();

    expect(entry?.resolveImage("logo.svg#mark")).toBe("/assets/logo.svg?compiled=1#mark");
    expect(() => entry?.resolveImage("logo.svg?download=1")).toThrow(/cannot append a query/u);
  });
});
