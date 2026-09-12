# SSR documentation site

`app/docs` is a private workspace application that uses the public Effront API to render its own documentation.
It combines six Guide pages, two Platforms pages, and seven Core implementation chapters in one shadcn/ui sidebar.
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

Pages are JSX functions in `src/content/guides.tsx`, `platforms.tsx`, `core-model.tsx`, and `core-runtime.tsx`.
Effront renders them on each request; no SSG or Markdown parser is involved.
Tailwind Typography styles articles, and the document starts in dark mode regardless of system preference.
Shiki tokenizes code on the server with locally imported grammars and a JavaScript regex engine.
The client receives rendered content and navigation metadata rather than the content registry or highlighter implementation.

To add a page, define its stable heading IDs and register its explicit route in `src/application.tsx`.
Update the catalog count when deliberately changing the number of pages.

## Core implementation chapters

- `/core/overview`: the core package's responsibilities and overall request flow.
- `/core/application`: application identity, definitions, services, and middleware views.
- `/core/routing`: route composition, compilation, and page parameter handling.
- `/core/request`: Fetch context, application Layer acquisition, and response resource lifetime.
- `/core/rendering`: Flight, SSR, HTML streaming, and payload embedding.
- `/core/navigation`: browser navigation, publication, and retained render resources.
- `/core/server-functions`: server-side action execution and UI refresh.

The former upstream-comparison chapters and `/reading/*` routes have been removed.
Upstream version, commit records, and license provenance remain in [UPSTREAM.md](UPSTREAM.md).
The site links upstream only through its [official website](https://effective-rsc.nikhilsnayak.dev/).

Core excerpts are exact contiguous selections of the current `packages/effront/src` files, embedded as authored strings.
`core.test.tsx` compares every excerpt with the current implementation during testing.
The browser suite also compares the actual no-JavaScript SSR text against local source, including whitespace and Shiki output.
Rendering performs no filesystem reads, Git execution, or GitHub requests to obtain code.
When implementation changes, update the relevant explanation and excerpt together.

## Audience

Guide teaches application usage, with a complete Cloudflare-based getting-started example.
Platforms owns host support and configuration.
Core teaches the framework's current internals, without repeating generic React or Effect tutorials.
Deferred features and alternative Node/Bun hosting designs remain in [ROADMAP.md](ROADMAP.md).
Contributor workflow and framework-level acceptance requirements belong here and in AGENTS.md, not in the consumer testing guide.

## Validation

Run `vp run check` and `vp run test` at the repository root.
From `tests/e2e`, run `vp run test:docs` for real Chromium acceptance against Vite/workerd and standalone Wrangler.
That project owns random ports, isolated builds, screenshots, and traces.
The suite checks all fifteen pages, local links and heading targets with JavaScript disabled, source excerpts, default dark contrast, Flight, hydration, sidebar filtering and mobile behavior, and removed-route 404 responses.
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
