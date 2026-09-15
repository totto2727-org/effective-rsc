import { Effect } from "effect";
import { MarkdownError } from "./error.ts";
import type { MarkdownCollectionOptions } from "./collection.ts";
import { describe, expect, it } from "vite-plus/test";
import { createMarkdownCollection } from "./collection.ts";

const create = (options: MarkdownCollectionOptions) =>
  Effect.runSync(createMarkdownCollection(options));

const collection = () =>
  create({
    basePath: "/manual",
    documents: {
      "./README.md": "# Read me",
      "./index.md": "# Manual",
      "./guides/index.md": "# Guides",
      "./guides/advanced.md": "# Advanced",
      "./guides/getting started.md": "# Getting started",
      "./guides/100%.md": "# Percent",
      "./guides/$&+,=@.md": "# Punctuation",
    },
    assets: {
      "./guides/diagram one.svg": "/assets/diagram-one.a1b2.svg",
      "./logo.svg": "/assets/logo.c3d4.svg",
    },
  });

describe("createMarkdownCollection", () => {
  it("maps nested documents to public routes without README magic", () => {
    const markdown = collection();

    expect(markdown.entries.map((entry) => [entry.source, entry.pathname, entry.url])).toEqual([
      ["./index.md", "/manual", "/manual"],
      ["./guides/index.md", "/manual/guides", "/manual/guides"],
      [
        "./guides/$&+,=@.md",
        "/manual/guides/%24%26%2B%2C%3D%40",
        "/manual/guides/%24%26%2B%2C%3D%40",
      ],
      ["./guides/100%.md", "/manual/guides/100%25", "/manual/guides/100%25"],
      ["./guides/advanced.md", "/manual/guides/advanced", "/manual/guides/advanced"],
      [
        "./guides/getting started.md",
        "/manual/guides/getting%20started",
        "/manual/guides/getting%20started",
      ],
      ["./README.md", "/manual/README", "/manual/README"],
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

  it("uses the glob-base-relative hierarchy without stripping a source directory", () => {
    const markdown = create({
      basePath: "/manual",
      documents: {
        "./index.md": "# Manual",
        "./content/index.md": "# Nested content",
        "./guide/deep/details.md": "# Details",
      },
      assets: { "./images/diagram.svg": "/assets/diagram.hash.svg" },
    });
    const details = markdown.get("/manual/guide/deep/details")!;
    expect(markdown.get("/manual/content")?.source).toBe("./content/index.md");
    expect(details.source).toBe("./guide/deep/details.md");
    expect(Effect.runSync(details.resolveLink("../../index.md#top"))).toBe("/manual#top");
    expect(Effect.runSync(details.resolveImage("../../images/diagram.svg"))).toBe(
      "/assets/diagram.hash.svg",
    );
  });

  it("looks up URL-encoded filenames without interpreting them as route patterns", () => {
    const markdown = create({
      basePath: "/manual",
      documents: {
        "./literal%20.md": "# Literal escape",
        "./what?.md": "# Question",
        "./hash#.md": "# Hash",
        "./:name.md": "# Colon",
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
    const markdown = create({
      basePath: "/",
      documents: { "./index.md": "# Root" },
    });
    expect(markdown.get(pathname)?.content).toBe("# Root");
  });

  it.each(["//", "///", "/./", "/%2E/", "/%00", "/%2F"])(
    "does not alias unknown paths to a root index: %s",
    (pathname) => {
      const markdown = create({
        basePath: "/",
        documents: { "./index.md": "# Root" },
      });
      expect(markdown.get(pathname)).toBeUndefined();
    },
  );

  it.each(["%2F", "%5C", "%00", "%2E", "%", "%E0%A4"])(
    "looks up a literal escape filename after decoding once: %s",
    (filename) => {
      const markdown = create({
        basePath: "/manual",
        documents: { [`./${filename}.md`]: "# Literal escape" },
      });
      expect(markdown.get(`/manual/${encodeURIComponent(filename)}`)?.content).toBe(
        "# Literal escape",
      );
    },
  );

  it("resolves document URLs, queries, fragments, and Vite asset URLs", () => {
    const markdown = collection();
    const entry = markdown.get("/manual/guides/advanced")!;
    expect(Effect.runSync(entry.resolveLink("index.md?mode=full#top"))).toBe(
      "/manual/guides?mode=full#top",
    );
    expect(Effect.runSync(markdown.resolveLink(entry, "getting%20started.md#install"))).toBe(
      "/manual/guides/getting%20started#install",
    );
    expect(Effect.runSync(entry.resolveLink("100%25.md"))).toBe("/manual/guides/100%25");
    expect(Effect.runSync(entry.resolveLink("?tab=examples#heading"))).toBe(
      "/manual/guides/advanced?tab=examples#heading",
    );
    expect(Effect.runSync(entry.resolveImage("diagram%20one.svg#icon"))).toBe(
      "/assets/diagram-one.a1b2.svg#icon",
    );
    expect(Effect.runSync(markdown.resolveLink(entry, "../logo.svg?download=1"))).toBe(
      "/assets/logo.c3d4.svg?download=1",
    );
  });

  it("leaves URL policy to Comark and the application", () => {
    const entry = collection().get("/manual/guides/advanced")!;
    for (const href of [
      "https://example.com/?q=1#top",
      "mailto:hello@example.com",
      "/global.svg",
      "//cdn.example.com/logo.svg",
      "#details",
      "data:image/png;base64,AA==",
    ]) {
      expect(Effect.runSync(entry.resolveLink(href))).toBe(href);
    }
  });

  it("uses Vite's already-resolved asset URLs including inline assets", () => {
    const markdown = create({
      basePath: "/manual",
      documents: { "./index.md": "" },
      assets: { "./logo.svg": "data:image/svg+xml;base64,AAAA" },
    });
    expect(Effect.runSync(markdown.get("/manual")!.resolveImage("logo.svg"))).toBe(
      "data:image/svg+xml;base64,AAAA",
    );
  });

  it.each([
    { basePath: "/manual", documents: { "index.md": "" } },
    { basePath: "manual", documents: {} },
    { basePath: "/manual?query=1", documents: {} },
    { basePath: "/manual", documents: { "../elsewhere/page.md": "" } },
    {
      basePath: "/manual",
      documents: { "./foo.md": "", "./foo/index.md": "" },
    },
    { basePath: "/manual", documents: { "./file.txt": "" } },
    {
      basePath: "/manual",
      documents: {},
      assets: { "../elsewhere/logo.svg": "/logo.svg" },
    },
  ])("returns configuration failures through the typed error channel: %j", (options) => {
    const error = Effect.runSync(Effect.flip(createMarkdownCollection(options)));
    expect(error).toBeInstanceOf(MarkdownError);
    expect(error._tag).toBe("MarkdownError");
  });

  it("returns missing and out-of-base references through the typed error channel", () => {
    const entry = collection().get("/manual/guides/advanced")!;
    for (const operation of [
      entry.resolveLink("missing.md"),
      entry.resolveImage("missing.svg"),
      entry.resolveLink("../../../outside.md"),
      entry.resolveLink("%2F.md"),
    ]) {
      expect(Effect.runSync(Effect.flip(operation))).toBeInstanceOf(MarkdownError);
    }
  });

  it("constructs a fresh collection on each Effect execution", () => {
    const effect = createMarkdownCollection({
      basePath: "/",
      documents: { "./index.md": "# Home" },
    });
    expect(Effect.runSync(effect)).not.toBe(Effect.runSync(effect));
  });
});
