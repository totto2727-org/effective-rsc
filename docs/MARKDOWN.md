# Markdown integration

## Purpose

This document describes the repository's Markdown integration and its verification boundaries.
For application setup and the public API, see [the package README](../packages/markdown/README.md).
The runnable example is `examples/markdown`.

## Responsibilities

Vite discovers documents with `import.meta.glob` and imports their contents with `?raw`.
Vite also resolves assets with `?url` and owns their development URLs, production emission, and hashing.
The Markdown package consumes those maps rather than implementing a filesystem loader, asset copier, or bundler.

The package maps source files to application URLs while preserving directory hierarchy.
For example, `content/index.md` maps to `/manual` and `content/guide/deep/details.md` maps to `/manual/guide/deep/details`.
Relative document links resolve from their containing source file and retain queries and fragments.
Asset references use URLs supplied by Vite.

`createMarkdownCollection`, `parseMarkdown`, and URL resolvers expose expected failures through `MarkdownError` in Effect's error channel.
Collection entries and `get` remain ordinary values and lookup operations.
A missing document is a lookup miss, allowing the application's catch-all middleware to return 404 before streaming.
Core delegates URL matching and decoding to Effect HTTP and only translates the named catch-all capture.
Collection lookup preserves segment boundaries and decodes each URL segment once, including literal percent filenames.

## Rendering

Parsing retains Comark's standard defaults and adds the mdts plugins for footnotes, math, Mermaid with Tokyo Night, and Shiki.
`parseMarkdown` prepares a Comark document and resolves link/image attributes before rendering.
Applications import Comark's standard `MarkdownDocument` directly and supply their own component mappings.
The package provides no React renderer factory, forced component mappings, or custom Math/Mermaid SSR replacements.

Content and plugins are trusted authored inputs.
This integration is not a sanitizer for untrusted submissions.
Standard Comark document rendering does not automatically register its separate Math/Mermaid components; rich no-JavaScript rendering is tracked in [the roadmap](ROADMAP.md#standard-rendering-and-deferred-rich-ssr).

## Verification

- Repository root: `vp run check` and `vp run test` validate formatting, lint, types, collection errors, URL mapping, parsing, and core contracts.
- `tests/e2e-build`: `vp run test` builds a dedicated fixture and runs browser checks against standalone Wrangler.
- `tests/e2e-dev`: `vp run test` starts Vite development and verifies Markdown edits, additions, and deletion using a minimal fixture.
- Each E2E project has its own fixed Vite and Playwright configuration and only the fixture assets needed for its tests.
- Temporary mutable fixture copies and artifacts stay in ignored package-local `tmp` directories.

Typed metadata, relationships, loaders, and richer SSR support remain separate roadmap items.
