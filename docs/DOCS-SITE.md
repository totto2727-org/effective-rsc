# SSR documentation site

`app/docs` is a private workspace application that uses the public Effront API to render its own documentation.
It combines nine Guide pages, two Platforms pages, five Advanced pages, seven API reference pages, and seven Architecture implementation chapters in one shadcn/ui sidebar.
The content is Japanese, with source identifiers and commands preserved in English.

## Run locally

Install dependencies with `vp install` at the repository root, then enter the site application:

```sh
cd app/docs
vp dev
```

Open the URL printed by Vite.
For independent local hosting of the built artifact:

```sh
vp build
vp exec wrangler dev --local --no-bundle --config dist/rsc/wrangler.json
```

Wrangler executes the generated Worker and nested SSR modules in workerd.
Local hosting needs no remote account or deployment.

## Rendering and authoring

Pages are JSX functions in `src/content/guides.tsx`, `guide-topics.tsx`, `platforms.tsx`, `advanced.tsx`, `api-reference.tsx`, `core-model.tsx`, and `core-runtime.tsx`.
Effront renders them on each request; no SSG or Markdown parser is involved.
Tailwind Typography styles articles, and the document starts in dark mode regardless of system preference.
Shiki tokenizes code on the server with locally imported grammars and a JavaScript regex engine.
The client receives rendered content and navigation metadata rather than the content registry or highlighter implementation.

To add a page, define its stable heading IDs and register its explicit route in `src/application.tsx`.
Update the catalog count when deliberately changing the number of pages.

## Architecture implementation chapters

- `/architecture/implementation/overview`: the core package's responsibilities and overall request flow.
- `/architecture/implementation/application`: application identity, definitions, services, and middleware views.
- `/architecture/implementation/routing`: route composition, compilation, and page parameter handling.
- `/architecture/implementation/request`: Fetch context, application Layer acquisition, and response resource lifetime.
- `/architecture/implementation/rendering`: Flight, SSR, HTML streaming, and payload embedding.
- `/architecture/implementation/navigation`: browser navigation, publication, and retained render resources.
- `/architecture/implementation/server-functions`: server-side action execution and UI refresh.

The former upstream-comparison chapters and `/reading/*` routes have been removed.
Upstream version, commit records, and license provenance remain in [UPSTREAM.md](UPSTREAM.md).
The site links upstream only through its [official website](https://effective-rsc.nikhilsnayak.dev/).

Architecture excerpts are exact contiguous selections of the current `packages/effront/src` files, embedded as authored strings.
`core.test.tsx` compares every excerpt with the current implementation during testing.
The browser suite also compares the actual no-JavaScript SSR text against local source, including whitespace and Shiki output.
Rendering performs no filesystem reads, Git execution, or GitHub requests to obtain code.
When implementation changes, update the relevant explanation and excerpt together.

## Audience

Guide teaches application usage, with a complete Cloudflare-based getting-started example.
Platforms owns host support and configuration.
Advanced explains application-facing runtime guarantees and operational boundaries.
API reference describes the current public package APIs and their type contracts.
Architecture > Implementation explains the framework's current internals, without repeating generic React or Effect tutorials.
Deferred features and alternative Node/Bun hosting designs remain in [ROADMAP.md](ROADMAP.md).
Contributor workflow and framework-level acceptance requirements belong here and in AGENTS.md, not in the consumer testing guide.

## Validation

Run `vp run check` and `vp run test` at the repository root.
From `tests/e2e`, run `vp run test:docs` for real Chromium acceptance against Vite/workerd and standalone Wrangler.
That project owns random ports, isolated builds, screenshots, and traces.
The suite checks all thirty pages, local links and heading targets with JavaScript disabled, source excerpts, default dark contrast, Flight, hydration, sidebar filtering and mobile behavior, and removed-route 404 responses.
A real client build graph excludes Shiki and compiler implementations; browser interception rejects unexpected external requests during rendering and navigation.
Browser interception does not observe server-side outbound traffic; the source and highlighter architecture use only embedded local data.

The stream injector preserves HTML chunk boundaries and emits embedded Flight payloads after HTML EOF, before the closing document trailer.
Cancellation during a pending Flight flush is covered by the core stream tests.
The stylesheet is imported by the exported Client DocsShell so initial SSR includes its CSS dependency.

## Sources and licenses

- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar).
- [Shiki](https://shiki.style/) and its [JavaScript regex engine](https://shiki.style/guide/regex-engines).
- [Tailwind CSS Typography](https://github.com/tailwindlabs/tailwindcss-typography).
- [VitePlus integrated checks](https://viteplus.dev/guide/check).
- [Third-party notices](../app/docs/THIRD-PARTY-NOTICES.md).

## Core chapter replacement validation

On 2026-09-12, `vp run check` passed formatting, lint, and type checks, and `vp run test` passed 273 tests across 36 files.
The documentation acceptance suite passed all 10 cases against separate Vite development and built Wrangler hosts.
The checks covered all 15 pages without JavaScript, all 14 current-source excerpts, navigation and heading links, dark typography, mobile sidebar behavior, and HTML/Flight 404 responses for all five removed Code Reading routes.
The public sidebar links upstream only through its official website.

## Upstream Guide and Advanced coverage

The official Guide and Advanced indexes were reviewed on 2026-09-12.
The site adapts their supported topics to current Effront rather than preserving upstream host-specific guarantees.

| Upstream chapter                      | Effront location                                  | Treatment and reason                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server Functions                      | `/guide/server-functions`                         | Dedicated guide for typed inputs, execution, and forms, separated from Component usage.                                                                              |
| Services                              | `/guide/effect`                                   | Retained, including required Layer provision and concrete missing-service type diagnostics.                                                                          |
| Routing                               | `/guide/routes`                                   | Retained with the current Page, Layout, parameters, and route composition contracts.                                                                                 |
| Middleware                            | `/guide/middleware`                               | Dedicated guide for derived application views and the distinction from native HTTP middleware.                                                                       |
| Userland HTTP                         | `/guide/http`                                     | Added native Effect HTTP routes through the application Layer; host-served assets remain outside this handler.                                                       |
| Deploying to Vercel                   | `/platforms`                                      | No deployment tutorial: the upstream Vercel adapter was removed and a current adapter is not provided. Platform support is tracked separately from framework guides. |
| Request runtime and lifetimes         | `/advanced/request-runtime-and-lifetimes`         | Retained with request-local application Layer construction and streaming lifetime, replacing upstream server-global runtime assumptions.                             |
| Client navigation                     | `/advanced/client-navigation`                     | Retained for current native Navigation API capabilities, fallback, cancellation, and cache behavior.                                                                 |
| Server Function execution and refresh | `/advanced/server-function-execution-and-refresh` | Retained for result ordering, refresh, and concurrent navigation guarantees.                                                                                         |
| Production startup                    | `/advanced/production-startup`                    | Rewritten for Vite build and host-adapter ownership. Specific host commands live in Platforms.                                                                       |

The removed Bun `ersc build` / `ersc start`, `start({ root, hostname, port })`, `.ersc` deployment layout, and `BuildHook` adapter API are not current Effront APIs.
Production startup therefore teaches the replacement build/host boundary rather than documenting those commands as usable.
The old development warning panel is not part of the retained browser runtime, so its UI is not described as an available feature.
Generic React and Effect concepts are linked to their official documentation, as requested, while Effront-specific Component usage and consumer testing remain useful additional guides.
Page ViewTransition defaults and overrides are documented in Advanced and API reference.
Future Node/Bun/Vercel hosting remains in ROADMAP.md.

## Architecture baseline and hierarchy

The sidebar and breadcrumb hierarchy is `アーキテクチャ > 実装解説 > chapter`, with a nested semantic list rather than another peer section.
Each implementation chapter displays `effront@0.1.4-workers.0`, baseline commit `68f3dfc809ec11a881b9b857648a3541abd78503`, and review date `2026-09-12`.
These values describe the implementation being explained, not the latest documentation commit or an assertion of npm publication.
The authored baseline is in `src/content/architecture-baseline.ts`.
Tests compare its package version and every implementation excerpt against that exact local Git object, in addition to comparing current source files.
Re-review the text and update the baseline deliberately when core implementation changes.

## Guide, Advanced, API reference, and hierarchy validation

The expanded site has 30 pages: nine Guide pages, two Platforms pages, five Advanced pages, seven API reference pages, and seven nested Architecture implementation chapters.
On 2026-09-12, the full suite passed 297 tests in 38 files, including four public Fetch integration cases for service-backed userland HTTP, request isolation, JSON status, resource release, and scoped/global middleware behavior.
An unmatched route returns 404 without the example's success-only `Effect.map` header; the Guide states this explicitly.
All 10 documentation browser cases passed against Vite development and independently hosted Wrangler builds, including no-JavaScript traversal of all pages, current-source and baseline metadata checks, nested semantic navigation, and mobile checks for new API and Advanced pages.
A long API identifier initially overflowed the desktop table of contents; applying word wrapping to TOC links resolved the observed overflow and the rerun passed.
The Guide author checked 18 extracted source files and the API reference author checked 17 CodeBlock examples against the installed public package types with the imports and surrounding definitions stated in the text.
Those extracted fixtures are temporary and are not substitutes for the real Fetch and browser acceptance checks above.
