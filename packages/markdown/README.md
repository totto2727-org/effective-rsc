# @effront/markdown

Render a directory of Markdown as React Server Components, preserving its hierarchy and resolving file-relative links and images to public URLs.
Vite supplies content through `import.meta.glob`; comark supplies the standard React renderer and Markdown plugins.

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
    query: "?url&no-inline",
    import: "default",
    eager: true,
  }),
});
```

`content/index.md` becomes `/manual`, and `content/guide/deep/details.md` becomes `/manual/guide/deep/details`.
Inside `content/guide/start.md`, `[Details](./deep/details.md#example)` becomes a link to `/manual/guide/deep/details#example`.
An image such as `![Diagram](../images/diagram.svg)` resolves against the source file's directory and uses the URL emitted by Vite.
The `no-inline` query makes even small assets individually fetchable; ordinary `?url` also supports Vite's inlining policy.

Route the whole collection through one catch-all Page and look up the entry for each request:

```tsx
import { Markdown, type MarkdownEntry } from "@effront/markdown";
import { Context, Effect, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

class CurrentEntry extends Context.Service<CurrentEntry, MarkdownEntry>()(
  "markdown-example/CurrentEntry",
) {}

const FindEntry = EFFRONT.Middleware.make<{ provides: CurrentEntry }>(
  Effect.fn(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const entry = manual.get(request.url);
    if (!entry) {
      return HttpServerResponse.text("Not found", { status: 404 });
    }
    return yield* httpEffect.pipe(Effect.provideService(CurrentEntry, entry));
  }),
);
const Manual = EFFRONT.withMiddleware(FindEntry);
const ManualPage = Manual.Page.make({
  params: Schema.Struct({ path: Schema.String }),
  render: () =>
    Effect.gen(function* () {
      const entry = yield* CurrentEntry;
      return (
        <article className="comark" data-markdown-page={entry.url}>
          <Markdown entry={entry} />
        </article>
      );
    }),
});

export default EFFRONT.make({
  routes: Manual.Routes.make({ layout: RootLayout }).page("/manual/*path", ManualPage),
});
```

Here `EFFRONT` is your `Application.effront()` identity, `manual` is the collection above, and `RootLayout` is a Layout created by that identity.
The [complete example](../../examples/markdown/src/application.tsx) includes their wiring.
`/manual/*path` matches `/manual`, `/manual/`, and any nested path; `params.path` is an already-decoded string without a leading slash.
The Middleware uses the original request URL for collection lookup, avoiding a second decoding of captured parameters.
It returns a real 404 before response streaming begins when no article exists and provides the found entry to the Page's request scope.
Adding or removing documents updates the collection, while the single catch-all route stays unchanged.

## Key features

- Directory-to-URL prefix mapping with arbitrary directory depth.
- Relative Markdown links, local asset links, and images resolved from their source files.
- Native React/Flight rendering and shared Effront Layout behavior.
- Footnotes, math, Mermaid, syntax highlighting, alerts, and task lists.
- Public component mappings and additional standard comark plugins.

## Prerequisites

Use a Vite-based React Server Components application with compatible React peer dependencies.
For Effront, use matching `effront`, `@effront/vite`, and host integration packages.
Keep collection imports and rendering in the server graph.

## Setup

```sh
vp add @effront/markdown
```

Import the provided stylesheet from a rendered Client Component's stylesheet or module, so the host includes it in the initial document:

```ts
import "@effront/markdown/styles.css";
```

It includes KaTeX styling and minimal content overflow rules; the application owns typography and page layout.

## API

### `createMarkdownCollection(options)`

- `source`: source directory prefix matching the glob keys, beginning with `./`.
- `basePath`: absolute public prefix such as `/manual` or `/`.
- `documents`: eager raw-string glob map of `.md` files.
- `assets`: optional eager URL-string glob map of linked files and images.

The collection exposes `entries`, `get(pathname)`, `resolveLink(entry, href)`, and `resolveImage(entry, src)`.
Each entry exposes `source`, `content`, public `url`/`pathname`, and its own `resolveLink`/`resolveImage` functions.
Use `url` for browser links and pass the original request pathname to `get`; URL escapes are decoded once for lookup.
The source Markdown remains unchanged.

Only `index.md` maps to the containing directory's URL; `README.md` keeps `/README`.
Query strings and fragments are preserved.
Fragment-only links, site-absolute links, and external URLs retain their original destination.
Relative `.md` links must identify an imported document, and relative asset references must identify an imported asset.
Missing references and attempts to leave the source directory produce an error naming the reference and source file.
Duplicate generated routes and invalid glob maps fail during collection creation.

Unicode and spaces are supported in source names and emitted URLs.
Source filenames are URL-encoded independently of the fixed catch-all route pattern.
Assets use the URLs emitted by Vite.

### `Markdown({ entry, components?, plugins? })`

An async server component using comark's standard parsed-document React renderer (`parseMarkdown` and `MarkdownDocument`).
`components` supplies standard React component mappings.
`plugins` appends standard comark plugins after the package defaults.
The link/image mappings resolve source URLs before forwarding props to custom link/image components.

### `createMarkdownRenderer(options?)`

Creates reusable component and plugin defaults.
Its `render({ entry, components?, plugins? })` method returns a Promise of React content.
Per-render component mappings override renderer mappings; plugin arrays are appended in renderer-then-render order.

### Default plugin policy

The defaults follow the main monorepo's `mdts-example/mdts.config.ts`: `footnotes()`, `math()`, `mermaid({ theme: "tokyo-night", themeDark: "tokyo-night" })`, and `shiki()`.
Comark's frontmatter, alerts, task lists, component syntax, and attributes are also enabled.
Shiki uses comark's default light/dark themes and JavaScript regex engine.

Math and Mermaid use thin synchronous KaTeX and beautiful-mermaid component mappings so their content is present in server-rendered HTML.
This replaces the upstream React mappings that wait for client effects, while retaining the standard comark parser and React rendering pipeline.
Raw HTML parsing is disabled by default, an intentional difference from mdts's implicit HTML plugin.
Treat Markdown, component mappings, and plugins as trusted authored content; this component-capable renderer is not a sanitizer for arbitrary user submissions.

### Content lifecycle

Vite performs collection discovery, raw imports, and asset URL generation during development/build.
SSR renders the collected content per request without a runtime filesystem dependency.
The current API provides file-based collection and rendering; schema-typed metadata, relationships, and remote loaders are future content-collection extensions.

References: [comark React](https://comark.dev/rendering/react), [Vite glob imports](https://vite.dev/guide/features.html#glob-import), [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/).

## Development

See the [repository contributor instructions](../../AGENTS.md).

## License

MIT. See [LICENSE](LICENSE).
