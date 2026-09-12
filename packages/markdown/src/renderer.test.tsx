import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { describe, expect, it } from "vitest";

import type { MarkdownEntry } from "./collection.ts";
import { Markdown, createMarkdownRenderer } from "./renderer.tsx";

const entry = (content: string): MarkdownEntry => ({
  content,
  pathname: "/manual/start",
  resolveImage: (source) => `/assets/${source}`,
  resolveLink: (href) => `/manual/${href}`,
  routePath: "/manual/start",
  source: "./content/start.md",
  url: "/manual/start",
});

const renderNode = async (node: ReactNode): Promise<string> =>
  await new Response(await renderToReadableStream(node)).text();

const render = async (content: string): Promise<string> =>
  renderNode(await Markdown({ entry: entry(content) }));

describe("Markdown renderer", () => {
  it("uses collection-aware standard Comark mappings for links and images", async () => {
    const html = await render("[Guide](guide.md)\n\n![Logo](images/logo.svg)");

    expect(html).toContain('href="/manual/guide.md"');
    expect(html).toContain('src="/assets/images/logo.svg"');
  });

  it("does not register Comark raw HTML parsing", async () => {
    const html = await render('<script>alert("unsafe")</script>');

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders math and Mermaid synchronously for SSR", async () => {
    const html = await render("Inline $x^2$.\n\n```mermaid\ngraph TD\n  A --> B\n```");

    expect(html).toContain('class="math inline"');
    expect(html).toContain("katex");
    expect(html).toContain('class="mermaid ');
    expect(html).toContain("<svg");
    expect(html).not.toContain("fonts.googleapis.com");
  });

  it("allows callers to override the default Math and Mermaid mappings", async () => {
    const renderer = createMarkdownRenderer({
      components: {
        Math: ({ content }: { readonly content: string }) => (
          <span data-kind="math">{content}</span>
        ),
        Mermaid: ({ content }: { readonly content: string }) => (
          <pre data-kind="mermaid">{content}</pre>
        ),
      },
    });
    const html = await renderNode(
      await renderer.render({ entry: entry("$x$\n\n```mermaid\ngraph TD\n  A --> B\n```") }),
    );

    expect(html).toContain('<span data-kind="math">x</span>');
    expect(html).toContain('<pre data-kind="mermaid">graph TD');
  });

  it("lets callers add standard Comark component mappings while retaining safe URL mappings", async () => {
    const renderer = createMarkdownRenderer({
      components: {
        h1: ({ children }: { readonly children?: ReactNode }) => (
          <h1 data-kind="custom">{children}</h1>
        ),
        ProseA: ({ children, href }: { readonly children?: ReactNode; readonly href?: string }) => (
          <a data-kind="prose-link" href={href}>
            {children}
          </a>
        ),
      },
    });
    const html = await renderNode(
      await renderer.render({ entry: entry("# Guide\n\n[Next](next.md)") }),
    );

    expect(html).toContain('<h1 data-kind="custom">Guide</h1>');
    expect(html).toContain('data-kind="prose-link"');
    expect(html).toContain('href="/manual/next.md"');
  });
});
