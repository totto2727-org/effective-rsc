# @effront/markdown

Collect Markdown through Vite and parse it into standard Comark documents with typed Effect failures.
File-relative document links and asset references become public URLs in the parsed AST, ready for Comark's React renderer.

## Setup

Use a Vite-based application with compatible React and Effect dependencies:

```sh
vp add @effront/markdown @comark/react
```

Keep collection imports and parsing in the server graph.
The application owns routing, typography, and layout.

## Usage

Place a collection module beside a `content/` directory:

```ts
import { createMarkdownCollection } from "@effront/markdown";

export const manual = createMarkdownCollection({
  source: "./content",
  basePath: "/manual",
  documents: import.meta.glob<string>("./content/**/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  assets: import.meta.glob<string>("./content/**/*.{svg,png,jpg,jpeg,gif,webp,pdf}", {
    query: "?url",
    import: "default",
    eager: true,
  }),
});
```

`manual` is an Effect, evaluated where the application handles configuration failures.
Vite owns document loading and asset URL generation, including its asset inlining policy.
Use `?url&no-inline` when each asset should have a separately fetchable URL.
No additional asset plugin, runtime filesystem loader, or copy step is required.

Parse inside your Page's Effect and pass the result to the standard Comark component:

```tsx
import { MarkdownDocument } from "@comark/react/components/MarkdownDocument";
import { parseMarkdown } from "@effront/markdown";
import type { MarkdownEntry } from "@effront/markdown";
import { Effect } from "effect";

export const renderArticle = (entry: MarkdownEntry) =>
  Effect.gen(function* () {
    const document = yield* parseMarkdown(entry);
    return <MarkdownDocument value={document} />;
  });
```

Use `yield* manual` to obtain the collection, then call `collection.get(request.url)` with the original request pathname or relative request URL.
`get` returns `undefined` for unknown pages, so the application can return a 404 before streaming begins.
The [complete Effront example](../../examples/markdown/src/application.tsx) uses one catch-all route with request-local entry selection.

## API

### `createMarkdownCollection(options)`

Returns `Effect<MarkdownCollection, MarkdownError>`.

- `source`: directory prefix matching the glob keys, beginning with `./`.
- `basePath`: absolute public prefix such as `/manual` or `/`.
- `documents`: eager raw-string glob map of `.md` files.
- `assets`: optional eager Vite URL-string glob map of linked files and images.

The resulting collection exposes pure `entries` and `get(pathname)` operations.
Each entry has `source`, `content`, and public `url`/`pathname` fields.
Only `index.md` maps to its containing directory's URL, while `README.md` keeps `/README`.
Filenames are percent-encoded independently of route patterns, and lookup decodes URL escapes once.
A single trailing slash is accepted for page lookup.

### Reference resolution

`entry.resolveLink(href)` and `entry.resolveImage(src)` return `Effect<string, MarkdownError>`.
The collection also exposes `resolveLink(entry, href)` and `resolveImage(entry, src)` with the same result type.

Inside `content/guide/start.md`, `[Details](./deep/details.md#example)` becomes `/manual/guide/deep/details#example`.
An image such as `![Diagram](../images/diagram.svg)` resolves from the Markdown file's directory and uses its imported Vite URL.
Queries and fragments are retained, and site-absolute, fragment-only, and external references pass through unchanged.
Reference queries and fragments are appended literally to the imported asset URL, without merging existing URL queries or fragments.
When an imported URL already contains a query or fragment, use a reference without a conflicting suffix or provide the final URL directly.
Relative `.md` links must identify an imported document, and relative asset references must identify an imported asset.
Unresolved references, references outside the collection, invalid configuration, and duplicate public routes return `MarkdownError` through the Effect error channel.
The source Markdown remains unchanged.

### `parseMarkdown(entry, options?)`

Returns `Effect<MarkdownDocument, MarkdownError>`, where `MarkdownDocument` is Comark's standard parsed-document type.
`options` accepts standard Comark `ParserOptions`; additional `plugins` are appended after the package's mdts plugins.
Parser exceptions become `MarkdownError`, preserving their original `cause`.
After parsing and plugin execution, the package maps literal `a.href` and `img.src` references in the AST.
Application-specific components and dynamic attribute bindings retain their normal Comark behavior.

Comark's default configuration remains enabled, including frontmatter, HTML, alerts, task lists, components, and attributes.
The mdts defaults add `footnotes()`, `math()`, `mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" })`, and `shiki()`.
Treat Markdown and its plugins as trusted authored content, not sanitized user submissions.

### Rendering and component mappings

Use `MarkdownDocument` from `@comark/react/components/MarkdownDocument` directly.
Pass user mappings through its normal `components` prop, for example `<MarkdownDocument value={document} components={{ ProseA: MyLink }} />`.
Resolved AST URLs reach those components without wrappers or forced link/image mappings.
Comark 0.6.2 does not automatically register Math or Mermaid React components or merge `document.meta.components`.
The package preserves the standard renderer's output and does not replace components, rewrite SVG/fonts, or add SSR workarounds.
Complete Math and Mermaid SSR support is deferred in the [roadmap](../../docs/ROADMAP.md).

The application owns all rendering styles.
The package retains KaTeX as a dependency because Comark's math parser plugin imports it directly, independently of React rendering.

## References

- [Comark React rendering](https://comark.dev/rendering/react)
- [Vite glob imports](https://vite.dev/guide/features.html#glob-import)
- [Effect expected errors](https://effect.website/docs/error-management/expected-errors/)
- [Repository contributor instructions](../../AGENTS.md)

## License

MIT. See [LICENSE](LICENSE).
