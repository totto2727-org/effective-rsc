import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { renderToReadableStream } from "react-dom/server.edge";
import type { ComponentPropsWithoutRef } from "react";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { createMarkdownCollection } from "./collection.ts";
import { MarkdownError } from "./error.ts";
import { parseMarkdown } from "./parse.ts";

const entry = (content: string) =>
  Effect.runSync(
    createMarkdownCollection({
      source: "./content",
      basePath: "/manual",
      documents: { "./content/index.md": content, "./content/guide.md": "# Guide" },
      assets: { "./content/logo.svg": "/assets/logo.hash.svg" },
    }),
  ).get("/manual")!;

describe("parseMarkdown", () => {
  it("resolves nested links and images in the Comark AST before rendering", async () => {
    const source = entry("- [**Guide**](guide.md#top)\n\n[![Logo](logo.svg)](guide.md)");
    const document = await Effect.runPromise(parseMarkdown(source));
    const serialized = JSON.stringify(document.nodes);
    expect(serialized).toContain('"href":"/manual/guide#top"');
    expect(serialized).toContain('"src":"/assets/logo.hash.svg"');
    expect(serialized).toContain('"href":"/manual/guide"');
    expect(source.content).toContain("(logo.svg)");
  });

  it("preserves Comark defaults including HTML, frontmatter, task lists, and attributes", async () => {
    const document = await Effect.runPromise(
      parseMarkdown(
        entry(
          "---\ntitle: Guide\n---\n\n# Title\n\n<strong>HTML</strong>\n\n- [x] Done\n\n::note\nContent\n::",
        ),
      ),
    );
    expect(document.frontmatter["title"]).toBe("Guide");
    const serialized = JSON.stringify(document.nodes);
    expect(serialized).toContain('"strong"');
    expect(serialized).toContain('"id":"title"');
    expect(serialized).toContain('"checkbox"');
    expect(serialized).toContain('"note"');
  });

  it("keeps mdts plugins without substituting their AST output", async () => {
    const document = await Effect.runPromise(
      parseMarkdown(
        entry(
          "Text[^1] and $x$.\n\n[^1]: Footnote.\n\n```mermaid\ngraph TD\n A --> B\n```\n\n```js\nconst answer = 42\n```",
        ),
      ),
    );
    const serialized = JSON.stringify(document.nodes);
    expect(serialized).toContain('["math",');
    expect(serialized).toContain('["mermaid",');
    expect(serialized).toContain("footnote");
    expect(serialized).toContain("shiki");
  });

  it("accepts standard parser options and runs user plugins before URL resolution", async () => {
    const document = await Effect.runPromise(
      parseMarkdown(entry("# Heading"), {
        headingIds: false,
        plugins: [
          {
            name: "append-link",
            post: ({ tree }) => {
              tree.nodes.push(["a", { href: "guide.md" }, "Guide"]);
            },
          },
        ],
      }),
    );
    expect(document.nodes[0]).toEqual(["h1", {}, "Heading"]);
    expect(document.nodes.at(-1)).toEqual(["a", { href: "/manual/guide" }, "Guide"]);
  });

  it("returns parser exceptions through MarkdownError with the original cause", async () => {
    const cause = new Error("plugin failed");
    const error = await Effect.runPromise(
      Effect.flip(
        parseMarkdown(entry("hello"), {
          plugins: [
            {
              name: "failed",
              pre: () => {
                throw cause;
              },
            },
          ],
        }),
      ),
    );
    expect(error).toBeInstanceOf(MarkdownError);
    expect(error.cause).toBe(cause);
  });

  it("returns unresolved references through MarkdownError", async () => {
    const error = await Effect.runPromise(
      Effect.flip(parseMarkdown(entry("[Missing](missing.md)"))),
    );
    expect(error).toBeInstanceOf(MarkdownError);
    expect(error.message).toContain("missing.md");
  });
});

describe("parsed documents with the standard Comark renderer", () => {
  it("passes resolved URLs to caller components without wrapping or replacing them", async () => {
    const document = await Effect.runPromise(
      parseMarkdown(entry("[Guide](guide.md)\n\n![Logo](logo.svg)")),
    );
    const render = (
      <MarkdownDocument
        value={document}
        components={{
          ProseA: ({ href, children }: ComponentPropsWithoutRef<"a">) => (
            <a data-custom="link" href={href}>
              {children}
            </a>
          ),
          img: ({ src, alt }: ComponentPropsWithoutRef<"img">) => (
            <img data-custom="image" src={src} alt={alt} />
          ),
        }}
      />
    );
    const html = await new Response(await renderToReadableStream(render)).text();
    expect(html).toContain('data-custom="link" href="/manual/guide"');
    expect(html).toContain('data-custom="image" src="/assets/logo.hash.svg"');
  });

  it("retains standard renderer output without Math or Mermaid SSR substitutions", async () => {
    const document = await Effect.runPromise(
      parseMarkdown(entry("Inline $x$.\n\n```mermaid\ngraph TD\n A --> B\n```")),
    );
    const html = await new Response(
      await renderToReadableStream(<MarkdownDocument value={document} />),
    ).text();
    expect(html).toContain('<math class="math inline"');
    expect(html).toContain("<mermaid ");
    expect(html).not.toContain("katex");
    expect(html).not.toContain("<svg");
  });
});
