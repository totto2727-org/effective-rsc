# Effront roadmap

This document records planned work and explicitly marked completed milestones; planned entries are not available APIs or supported-host guarantees.

## Static site generation: HTML and Flight

Status: planned by user request on 2026-09-12; no SSG implementation or static-host compatibility is claimed yet.

### Goal

- Generate both the initial document HTML and a separately fetchable React Server Components payload for every statically generated route.
- Reuse Effront's native Flight format, hydration, client navigation, shared Layout retention, history handling, and ViewTransition behavior rather than introducing a second client rendering protocol.
- Initial document requests receive HTML with the hydration data they need; subsequent client navigations and current-route refreshes can fetch only the Flight payload.
- Aim for the same client rendering and navigation semantics as SSR for equivalent content. Static snapshots do not provide request-time freshness, personalized responses, or Server Function execution by themselves.

### Serving without a Worker

- The current SSR client requests Flight at the document URL with `Accept: text/x-component` (`packages/effront/src/client/flight-client.ts`).
- Serving HTML and Flight at the same URL requires host-side content negotiation or header-aware routing. Do not assume that a plain static-file host can select different files from this header; `Vary: Accept` describes cache variation, not a rule for selecting the response file.
- Prefer investigating distinct static payload URLs plus a generated route-to-payload manifest. For example, `/guide/routes` serves HTML and an internal versioned asset URL serves its Flight payload; these paths are illustrative, not a committed public convention.
- The client loader would resolve the payload asset while retaining the canonical document URL for history, links, hashes, and redirect semantics. The current loader uses `response.url`, so merely changing the fetch URL would incorrectly treat the asset URL as a navigation destination.
- Distinct resource paths allow an asset-only serving model without requiring a Worker to inspect request headers. Verify the chosen static host's MIME headers, document-path resolution, and cache rules before declaring support.
- Preserve `text/x-component` for Flight and avoid SPA fallback rules that return HTML for a missing payload. Define a safe document-navigation fallback for missing or incompatible artifacts without redirect loops.
- Keep header-negotiated delivery as an optional host capability, not a prerequisite for the baseline SSG output.

### Build and data boundaries

- Enumerate static routes and parameter values explicitly. Define handling of query-dependent variants and unknown paths rather than assuming every request maps to the same snapshot.
- Provide build-time Effect services and complete/dispose each prerender's resources. Reject or explicitly defer routes requiring request-specific credentials, cookies, or runtime bindings.
- Produce HTML, Flight, client chunks, and the route manifest from one build; version their references and define atomic deployment/cache invalidation so clients do not mix incompatible React module references.
- Static refresh reads the published snapshot. Data changes require a new published build or a separately configured dynamic host; Server Functions still need a server endpoint.
- Allow later SSR/SSG hybrid routing as a separate integration decision without making dynamic hosting necessary for purely static routes.

### Acceptance before release

- Serve real generated output through an asset-only host with no Worker or application server and verify direct document loads, no-JavaScript HTML, hydration, and Flight-only subsequent navigation.
- Compare the same routes rendered by SSR and SSG for content, shared Layout state, ViewTransitions, Back/Forward, anchors, and current-route refresh. Equivalent behavior does not imply identical network timing or request-time data freshness.
- Verify payload MIME types, parameter/query policy, redirects, unknown routes, missing payloads, cache isolation, and deployment-version mismatch handling.
- Confirm that secrets and request-specific data cannot enter public static artifacts and that generation handles streaming failures and resource cleanup.

## Markdown rendering and content collections

Status: planned by user request on 2026-09-12; implementation and public API design are deferred.

### Direction

- Use comark for Markdown rendering, taking the main monorepo's `js/app/mdts` and `js/app/mdts-example` as local references for content authoring and plugin configuration.
- The current mdts integration exports HTML rendering and plugins through `@comark/html` in `src/comark.ts`. For Effront, prefer comark's standard React integration rather than reproducing that HTML adapter or writing a custom Markdown-to-React renderer.
- Verify the chosen React integration's Server Component, SSR, streaming, and Workers compatibility before selecting its public API. Keep parsing and server-only rendering dependencies out of the client graph.
- Start with a straightforward Markdown-to-React content path usable inside existing Effront Pages and shared Layouts. Preserve JSX authoring and allow application-owned React component mappings where the integration supports them.
- Reuse the existing Shiki and Typography presentation policy where appropriate; determine how comark plugins compose with it instead of adding a second highlighting pipeline by default.

### Target: typed content collections

- Aim for an Astro Content Collections-like authoring experience: named collections, content loaders, schema-validated metadata, stable entry IDs, typed lookup/query APIs, and a separate rendering step.
- Define metadata validation, useful file/entry diagnostics, duplicate-ID handling, and relationships between entries before stabilizing the API.
- Separate content loading and indexing from route creation so an application can choose URLs, parameters, Layouts, and rendering policy.
- Integrate local content discovery, changes, additions, and removals with Vite development and the production build. Preprocess or bundle local files as needed so Workers SSR does not depend on a runtime filesystem.
- Begin with SSR as the rendering target. Content collections do not require SSG; the separate HTML/Flight SSG milestone can later consume the same entries and route enumeration.
- Keep runtime-specific loading and build integration outside the portable core. Decide package boundaries during implementation rather than committing to package names now.

### Acceptance before release

- Render representative real content through the public integration on Vite development and a standalone built Wrangler host, including no-JavaScript HTML, Flight navigation, custom React components, and the existing shared Layout behavior.
- Verify metadata types and validation errors, stable IDs and lookup, development updates, production packaging, and the absence of server-only parsing/highlighting code in client bundles.
- Define and test the trust boundary for raw HTML, links, and embedded components; distinguish trusted repository-authored content from externally supplied Markdown.
- Check the selected comark integration and plugin versions through actual React/RSC execution before documenting supported features.

References: [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/), [comark](https://comark.dev/), and the local main-monorepo mdts implementation noted above.

## Page View Transitions

Status: implemented after the user's 2026-09-12 request to enable page transitions by default.

- Core wraps each routed Page in a React ViewTransition client boundary; shared Layouts remain outside it.
- `PageViewTransition` from `effront` is a defaulted Effect reference configurable with `Layer.succeed(PageViewTransition, config)`.
- `Page.make({ viewTransition: config, render })` overrides supplied properties; `viewTransition: false` disables that Page's boundary.
- Built-in defaults, application Layer settings, and page settings are resolved in that order, with transition-class maps replaced as whole properties.
- `enabled: true` can re-enable a page under a disabled application default.
- Only serializable class settings cross Flight; application callbacks remain in application-owned React boundaries.
- Existing navigation types and `data-effront-transition-types` are reused without changing native navigation commit or stream lifetimes.
- Reduced motion suppresses framework page animations while preserving the page subtree. The default class map uses `auto`, with `hmr-refresh` and `navigation-ua-visual-transition` mapped to `none`; applications can override that map.
- The outgoing and incoming pages retain their own policy; disabling the destination does not retroactively disable an enabled outgoing page's exit animation.

See the consumer documentation at `/advanced/client-navigation#transition-scope` and `/api-reference/components#view-transition`.
See [ViewTransition validation](VIEW-TRANSITIONS.md) for the observed acceptance results and limits.

References: [React ViewTransition](https://react.dev/reference/react/ViewTransition), [React addTransitionType](https://react.dev/reference/react/addTransitionType).

## Server runtime adapters

Status: planned; Node and Bun server adapters will be designed separately.

- Keep `src/entry.client.ts` as the application definition export.
- Use `src/entry.workers.ts` as the Web Fetch export and the default Vite RSC entry.
- Vite + Cloudflare consumes `entry.workers.ts` directly.
- For future Node/Bun hosts, use `src/entry.server.ts` for host startup and evaluate two integration paths: adapt the Fetch export from `entry.workers.ts`, or host the application directly through Effect HTTP.
- For direct Effect HTTP hosting, build the application Runtime and reusable Layers once per server lifecycle instead of rebuilding them per request.
- Keep request-specific values and resources in isolated request scopes, preserving response streaming, cancellation, and finalization semantics.
- Treat improved throughput and reduced allocation from Runtime reuse as a performance hypothesis, not a measured result; compare both paths under representative concurrent SSR/Flight traffic before selecting the default.
- Measure startup cost, latency, throughput, memory, and shutdown cleanup, and distinguish Runtime-reuse benefits from Fetch-conversion overhead.
- Preserve the current Workers Fetch implementation while evaluating these server-only alternatives.
- Keep server startup and runtime-specific adaptation outside the reusable Fetch entry.
- Validate streaming, cancellation, request context, static assets, and server startup/shutdown through each real adapter before documenting it as supported.
