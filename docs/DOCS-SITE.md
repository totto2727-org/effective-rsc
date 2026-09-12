# SSR documentation site

`packages/docs` is a private workspace application that uses the public `effective-rsc` and `effective-rsc/workers` entry points to render its own documentation.
It combines seven introductory Guide pages and five upstream-comparison reading chapters in one shadcn/ui sidebar.
The content is Japanese, with source identifiers and commands preserved in English.

## Run locally

Install dependencies with `vp install` from the repository root, then enter the site package:

```sh
cd packages/docs
vp dev
```

Open the URL printed by Vite.
The root workspace intentionally has no site-startup wrapper.
For Vite-independent local Workers hosting, run the following from the same package:

```sh
vp build
vp run local
```

Wrangler runs the generated `dist/rsc/wrangler.json` and its nested SSR modules in workerd.
No Cloudflare account, remote binding, database, or deployment is required.

## Rendering and authoring

There is no SSG, prerender job, static HTML export, MDX loader, or Markdown runtime parser.
Pages are JSX functions in `src/content/guides.tsx` and `src/content/reading.tsx`, rendered through ERSC Page definitions on an HTTP request.
This keeps code-diff tables and annotated examples straightforward without introducing a content compiler.
`@tailwindcss/typography` styles the server-rendered article through `prose`.
The initial server-rendered document uses dark mode regardless of the operating-system preference; there is no theme-toggle or hydration-dependent theme initialization.
Code and diff blocks use Shiki on the server with statically imported grammars and its JavaScript regex engine.
No browser highlighter, remote grammar download, or WASM asset initialization is required.
The hydrated shadcn/ui sidebar receives only navigation metadata and rendered children, not the content function registry.

To add a page, add a `DocPage` to the appropriate content array, give its headings stable IDs, and register its explicit route in `src/application.tsx`.
The framework's route typing and native unknown-route handling remain in use.
Update the catalog count assertion when deliberately adding or removing a page.
The colocated catalog test checks uniqueness and heading targets; the browser suite checks public navigation and SSR.

## Comparison provenance

The reading material compares upstream `ed886996d1d3780b94166af4f798c53416d547c8` (version `0.1.4`) with the local pre-site revision `9058a71`.
It includes concrete diff excerpts, changed file structure, reasons for the port, retained behavior, and commands to inspect the complete changes locally.
Diffs and source excerpts are generated from local Git objects and embedded as fixed JSX data.
Neither rendering nor navigation queries GitHub to obtain differences.
Updating the comparison is an explicit authoring step using the recorded local reproduction commands.
Local fork hashes are not presented as available upstream GitHub commits.
Advanced topics and API reference are external navigation links, not additional reference implementations.

## Checks

The site TypeScript configuration extends `@tsconfig/strictest` with `exactOptionalPropertyTypes: false` and no include/exclude overrides.
Run `vp check` and `vp test run` from the repository root for static checks and normally discovered tests.
From `packages/e2e`, run `vp run test:docs` for real Chromium acceptance through Vite/workerd and standalone Wrangler.
That independent project owns the browser tests, random test ports, isolated builds/state, screenshots, and traces.
Normal site configuration does not contain test-only port, inspector, or persistence overrides.

## Integration findings

The larger documentation pages exposed unsafe placement of embedded Flight scripts between arbitrary streamed HTML chunks.
The framework now preserves the HTML byte stream and emits Flight payload scripts only after HTML EOF, before the closing document trailer.
This delays the embedded hydration payload until HTML finishes, while keeping HTML streaming and preserving split UTF-8 and binary bytes.
Cancellation during pending Flight flush also releases the render scope rather than deadlocking.
The existing Workers example browser suite passed after this framework correction.

The site stylesheet is imported by the exported Client `DocsShell`, allowing the RSC plugin to associate it with the client reference and deliver it with the initial SSR page.
The ERSC application-definition object is not itself a renderable component export, so a stylesheet side-effect import there did not provide the required dependency boundary.
Client Components still produce server-rendered initial HTML, including the sidebar.

## Observed acceptance

The final frozen-lockfile install and `vp check` passed, and `vp test run` passed all 235 tests in 31 files.
The highlighter adds 26 tests covering initialization/rendering with network and WASM unavailable, supported language aliases, escaped markup, exact whitespace and line endings, and request-independent tokenization.
The normal `packages/docs` production build also passed.

The final documentation browser run passed all 10 cases across actual Vite/workerd development and independently built Wrangler local hosting.
It exercised the following public behavior, rather than substituting mocked framework modules:

- Every local page, navigation link, and heading target renders and remains readable with JavaScript disabled.
- The initial page is dark even when the browser system preference is light, with measured readable foreground and highlighted-token contrast.
- Guide code and actual Git diff excerpts contain server-rendered Shiki tokens while preserving the expected source text.
- Real client navigation, sidebar search, mobile open/Escape/focus restoration/link dismissal, and unknown routes work without hydration errors.
- Desktop sidebar label geometry and desktop/mobile horizontal overflow checks pass; final screenshots were inspected, including a highlighted diff.
- Browser rendering and internal navigation do not request GitHub/API resources.
- The actual built client module graph contains 213 modules and two assets, with no Shiki, Oniguruma, or TextMate implementation modules or assets.

Browser request interception does not observe server-side outbound requests.
The server highlighter uses locally imported grammars and theme data, and the comparison content is embedded from local Git objects rather than fetched remotely.
The final browser evidence is kept as ignored temporary artifacts under `packages/e2e/tmp/docs-run-0hLRSo/`.
The existing Workers example's nine browser cases also passed after the stream-injection correction.
No remote Cloudflare deployment was performed or required for this local-hosting acceptance.

## Static-check entry point

Use `vp check` rather than a separate typecheck script.
The root VitePlus configuration enables `lint.options.typeAware` and `lint.options.typeCheck`, which are required for integrated TypeScript diagnostics.
Temporary incompatible-assignment probes in the root, docs, and E2E projects were rejected with TS2322 by both `vp check` and `vp check --no-fmt --no-lint`; the probes were removed and the clean check passed.
Compiler commands that emit package build artifacts remain build steps, not duplicate validation entry points.

## Sources and licenses

- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar) and the [official registry](https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json).
- [Shiki](https://shiki.style/) and its [JavaScript regex engine](https://shiki.style/guide/regex-engines).
- [VitePlus integrated checks](https://viteplus.dev/guide/check).
- [Tailwind CSS Typography](https://github.com/tailwindlabs/tailwindcss-typography).
- [Site third-party notices](../packages/docs/THIRD-PARTY-NOTICES.md) for copied/adapted shadcn components.
- [Upstream baseline](UPSTREAM.md) for the original effective-rsc source and license provenance.
