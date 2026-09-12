# Markdown integration

## Public contract

`@effront/markdown` receives eager Vite glob maps, indexes Markdown documents under a public prefix, and renders entries with comark's standard parsed-document React integration.
The runnable consumer is `examples/markdown`; run `vp dev`, `vp build`, or `vp run local` from that directory.
See [the package README](../packages/markdown/README.md) for installation, component overrides, URL rules, and complete usage.

`content/index.md` maps to `/manual`, while `content/guide/deep/details.md` maps to `/manual/guide/deep/details`.
Relative links resolve from the containing source file, preserving query strings and fragments.
Images and non-document links resolve through the supplied Vite asset map.
A single named catch-all Page handles the collection. Middleware looks up the original request URL, returns 404 before streaming for missing entries, and provides the found entry through request-scoped Effect context.

## Default rendering

The reference configuration is the main monorepo's `js/app/mdts-example/mdts.config.ts`, using the main monorepo's mdts comark integration.
The plugin set includes footnotes, math, Mermaid with Tokyo Night in both modes, and Shiki, alongside comark's non-HTML defaults.
Comark React 0.6.2's convenience Markdown component statically imports client parsing branches, so this package uses the public `parseMarkdown` and `MarkdownDocument` path.
Math and Mermaid use standard component mappings backed by synchronous KaTeX and beautiful-mermaid rendering, making their output visible without JavaScript.
The generated Mermaid font imports are removed because beautiful-mermaid 1.1.3 emits a remote Google Fonts import even with a system font configured.

Raw HTML parsing is disabled by default, unlike mdts's implicit HTML default.
Content, plugins, and component mappings remain trusted authored inputs; the renderer is not a sanitizer for arbitrary user submissions.
Custom link and image components receive collection-resolved URLs.

## Verification entry points

- `vp run check` from the repository root checks formatting, lint rules, and types.
- `vp run test` from the root covers collection URL semantics, standard React SSR rendering, core route contracts, and retained regressions.
- `vp run test:markdown` from `tests/e2e` builds and runs the actual example through Vite/workerd and independent Wrangler.
- The Markdown browser suite checks no-JavaScript HTML, standard plugins, nested direct and Flight responses, image response bytes, shared Layout state, history, query/hash links, Unicode paths, unknown routes, and actual client bundle modules.
- Its dev-only case edits, adds, and deletes real Markdown files and restores its temporary changes.
- The bundle audit is built-host-only, while content HMR is dev-only; the other host's corresponding cases are intentionally skipped.

Temporary logs, browser traces, build graphs, and package tarballs remain under ignored repository `tmp` directories.
No Cloudflare deployment, npm publication, or upstream pull request is required for this verification.

## Future collection features

Schema-validated metadata, typed relationships, and extensible loaders remain a separate milestone in [the roadmap](ROADMAP.md).
Creating its follow-up issue is currently blocked because the fork has GitHub Issues disabled.

## Catch-all SSR acceptance on 2026-09-12

- Root VitePlus check passed; Vitest passed 356 tests in 45 files.
- Markdown browser acceptance passed 32 cases, with two intentional host-specific skips.
- Existing Workers acceptance passed 36 cases; documentation acceptance passed 12 cases.
- One `/manual/*path` route serves the directory root and arbitrary nested documents through request-time lookup.
- Unknown documents return 404 for HTML and Flight before streaming begins. Malformed escapes, encoded separators, and control characters are rejected before lookup.
- Real dev content editing, glob addition, and glob deletion update the collection while the route stays fixed. The added filename includes literal `%20`, exercising decode-once behavior through its `%2520` URL.
- Built client module inspection found no Markdown parser or highlighter implementation; browser requests required no remote font service.
- The npm tarball contains public source, stylesheet, README, and license, without tests or temporary evidence.
- The earlier enumeration prototype is preserved only on the backup branch recorded in the SSG roadmap. Its public API, opaque types, dedicated tests, and static-registration entry property have been removed from the current source tree.
