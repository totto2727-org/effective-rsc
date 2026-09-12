import { MarkdownDocument as ComarkMarkdownDocument } from "@comark/react/components/MarkdownDocument";
import type { MarkdownDocumentProps as ComarkMarkdownDocumentProps } from "@comark/react/components/MarkdownDocument";
import alert from "@comark/react/plugins/alert";
import attributes from "@comark/react/plugins/attributes";
import components from "@comark/react/plugins/components";
import footnotes from "@comark/react/plugins/footnotes";
import frontmatter from "@comark/react/plugins/frontmatter";
import math from "@comark/react/plugins/math";
import mermaid from "@comark/react/plugins/mermaid";
import shiki from "@comark/react/plugins/shiki";
import taskList from "@comark/react/plugins/task-list";
import { renderMermaidSVG, THEMES } from "beautiful-mermaid";
import { parseMarkdown } from "comark";
import type { MarkdownDocument, ParserOptions } from "comark";
import katex from "katex";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import type { MarkdownEntry } from "./collection.ts";

/**
 * The plugins used by mdts, with Comark's non-HTML defaults made explicit.
 *
 * Embedded HTML is deliberately omitted. This renderer is for trusted,
 * repository-authored Markdown, not a sanitizer: Comark components and
 * attributes can still create elements. Markdown links and images are resolved
 * through the entry's collection-aware URL resolvers instead.
 */
const defaultPlugins = [
  frontmatter(),
  alert(),
  taskList(),
  components(),
  attributes(),
  footnotes(),
  math(),
  mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" }),
  shiki(),
];

export interface MarkdownRendererOptions {
  /** Additional standard Comark component mappings. Link and image mappings remain collection-safe. */
  readonly components?: ComarkMarkdownDocumentProps["components"];
  /** Additional Comark plugins, evaluated after the standard Markdown defaults. */
  readonly plugins?: ParserOptions["plugins"];
}

export interface MarkdownRenderOptions {
  /** A collection entry whose URL resolvers map local document and asset references. */
  readonly entry: MarkdownEntry;
  /** Per-render standard Comark component mappings. */
  readonly components?: ComarkMarkdownDocumentProps["components"];
  /** Additional per-render Comark plugins. */
  readonly plugins?: ParserOptions["plugins"];
}

export interface MarkdownRenderer {
  render(options: MarkdownRenderOptions): Promise<ReactNode>;
}

const createLink = (entry: MarkdownEntry, Component: ElementType) => {
  const Link = ({ href, ...props }: ComponentPropsWithoutRef<"a">) => (
    <Component {...props} href={href === undefined ? undefined : entry.resolveLink(href)} />
  );
  Link.displayName = "MarkdownLink";
  return Link;
};

const createImage = (entry: MarkdownEntry, Component: ElementType) => {
  const Image = ({ src, ...props }: ComponentPropsWithoutRef<"img">) => (
    <Component {...props} src={src === undefined ? undefined : entry.resolveImage(src)} />
  );
  Image.displayName = "MarkdownImage";
  return Image;
};

interface MathProperties {
  readonly className?: string;
  readonly content: string;
}

/** Synchronous KaTeX mapping for RSC/SSR. The upstream React mapping is client-only. */
const ServerMath = ({ content, className = "" }: MathProperties) => {
  const inline = className.includes("inline");
  const html = katex.renderToString(content, { displayMode: !inline, throwOnError: false });
  const properties = {
    className: `math ${inline ? "inline" : "block"}`,
    dangerouslySetInnerHTML: { __html: html },
  };

  return inline ? <span {...properties} /> : <div {...properties} />;
};

interface MermaidProperties {
  readonly className?: string;
  readonly content: string;
  readonly height?: string;
  readonly theme?: string;
  readonly width?: string;
}

/** Synchronous SVG mapping for RSC/SSR. The upstream React mapping waits for effects. */
const ServerMermaid = ({
  className = "",
  content,
  height = "auto",
  theme = "tokyo-night",
  width = "100%",
}: MermaidProperties) => {
  const svg = renderMermaidSVG(content, {
    ...(THEMES[theme] ?? THEMES["tokyo-night"]),
    font: "system-ui, sans-serif",
  });
  // beautiful-mermaid 1.1.3 always emits Google Fonts imports, even for a
  // system font. Keep its local SVG/style output but remove those remote loads.
  const localSvg = svg
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("@import url("))
    .join("\n");

  return (
    <div
      className={`mermaid ${className}`}
      dangerouslySetInnerHTML={{ __html: localSvg }}
      style={{ display: "flex", height, justifyContent: "center", width }}
    />
  );
};

/**
 * Creates a server-only Comark Markdown renderer.
 *
 * The standard Comark parser and `<MarkdownDocument>` component parse and render
 * in the RSC or SSR graph. This module must never be imported by a browser entry.
 * Raw embedded HTML is not registered. Local URLs are mapped by the collection's
 * validated resolvers through the standard `a` and `img` mappings.
 */
export const createMarkdownRenderer = (
  options: MarkdownRendererOptions = {},
): MarkdownRenderer => ({
  async render({ entry, components: renderComponents, plugins: renderPlugins }) {
    const componentMappings = { ...options.components, ...renderComponents };
    const Link =
      componentMappings["ProseA"] ?? componentMappings["a"] ?? componentMappings["A"] ?? "a";
    const Image =
      componentMappings["ProseImg"] ??
      componentMappings["img"] ??
      componentMappings["Img"] ??
      "img";

    const document = await parseMarkdown(entry.content, {
      plugins: [...defaultPlugins, ...(options.plugins ?? []), ...(renderPlugins ?? [])],
      registerDefaultPlugins: false,
    });

    return (
      <ComarkMarkdownDocument
        components={{
          Math: ServerMath,
          Mermaid: ServerMermaid,
          ...componentMappings,
          A: createLink(entry, Link),
          Img: createImage(entry, Image),
          ProseA: createLink(entry, Link),
          ProseImg: createImage(entry, Image),
          a: createLink(entry, Link),
          img: createImage(entry, Image),
        }}
        value={document}
      />
    );
  },
});

const defaultRenderer = createMarkdownRenderer();

/** Renders one collection entry with the default server-only Comark renderer. */
export const Markdown = async (options: MarkdownRenderOptions): Promise<ReactNode> =>
  await defaultRenderer.render(options);

/** A parsed Comark document type for callers that parse and map documents upstream. */
export type { MarkdownDocument };
