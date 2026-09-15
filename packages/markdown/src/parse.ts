import footnotes from "comark/plugins/footnotes";
import math from "comark/plugins/math";
import mermaid from "comark/plugins/mermaid";
import shiki from "comark/plugins/shiki";
import { parseMarkdown as parseComark } from "comark";
import type { MarkdownDocument, Node, ParserOptions } from "comark";
import { Effect } from "effect";

import type { MarkdownEntry } from "./collection.ts";
import { MarkdownError } from "./error.ts";

const defaultPlugins = [
  footnotes(),
  math(),
  mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" }),
  shiki(),
];

/** Parses trusted Markdown with Comark, then maps file references in its AST. */
export const parseMarkdown = (
  entry: MarkdownEntry,
  options: ParserOptions = {},
): Effect.Effect<MarkdownDocument, MarkdownError> =>
  Effect.gen(function* () {
    const document = yield* Effect.tryPromise({
      try: () =>
        parseComark(entry.content, {
          ...options,
          plugins: [...defaultPlugins, ...(options.plugins ?? [])],
        }),
      catch: (cause) =>
        new MarkdownError({ message: `Failed to parse Markdown: ${entry.source}`, cause }),
    });
    const visit = (node: Node): Effect.Effect<void, MarkdownError> =>
      Effect.gen(function* () {
        if (typeof node === "string" || node[0] === null) return;
        const [tag, attributes, ...children] = node;
        if (tag === "a" && typeof attributes["href"] === "string") {
          attributes["href"] = yield* entry.resolveLink(attributes["href"]);
        }
        if (tag === "img" && typeof attributes["src"] === "string") {
          attributes["src"] = yield* entry.resolveImage(attributes["src"]);
        }
        for (const child of children) yield* visit(child);
      });
    for (const node of document.nodes) yield* visit(node);
    return document;
  });
