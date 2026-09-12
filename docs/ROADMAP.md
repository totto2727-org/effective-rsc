# Effront roadmap

This document records planned work, not available APIs or supported-host guarantees.

## Page View Transitions

Status: deferred by user request on 2026-09-12. Implement after the current documentation work, not as part of it.

### Existing support verified on 2026-09-12

Reviewed source baseline: `e2b8ea7`.
The current client already publishes React transition types; the missing feature is an optional framework-owned boundary/default-policy API, not transition classification.

- `packages/effront/src/client/client-router.ts` calls `addTransitionType` inside the `startTransition` that publishes the destination tree.
- Routed navigation adds `navigation` and `navigation-push`, `navigation-replace`, or `navigation-traverse`; push adds `navigation-forward`, traversal compares history indices, and UA visual transitions add `navigation-ua-visual-transition`.
- Links use `data-effront-transition-types` for additional whitespace-separated types on push/replace, with duplicates and reserved `navigation`, `navigation-*`, `server-function`, and `hmr-refresh` names removed.
- Link-specific types are not replayed on history traversal.
- `client/call-server.ts` tags Server Function response publication with `server-function`; `client/route-refresh.ts` tags the initial refresh publication with its supplied type.
- These notifications are integration points for application-owned React `ViewTransition` boundaries and CSS.
- Effront does not currently supply a `PageViewTransition` API or automatically wrap all pages in an animation boundary.

### Revised proposed direction

- Preserve the existing transition-type protocol rather than adding a second navigation or animation scheduler.
- First validate application-owned React `ViewTransition` boundaries against the existing public router in a real browser.
- Then offer an optional `PageViewTransition` policy service/Layer for application defaults and page/route-scoped overrides, if it meaningfully reduces application wiring.
- Treat the name and API shape as provisional until a prototype proves the Layer's route scope and the rendering boundary's scope align.
- Resolve policy in this order: explicit page override, nearest route scope, application default, no framework-added boundary.
- Pass only serializable resolved policy through Flight, such as enablement, stable boundary names, and transition-type/class mappings; keep CSS and client callbacks in application modules.
- Place the optional React boundary around the changing page subtree while retaining shared Layout identity and application-owned nested boundaries.
- Keep link attributes as additive transition labels, not an implicit override of every page policy.
- Design outgoing and incoming policy resolution explicitly: the outgoing tree remains live while the destination prepares, so a destination Layer alone cannot configure both trees retroactively.
- Commit the destination's first UI without waiting for Flight EOF; retain the existing native URL/history/focus/scroll lifecycle and stream ownership.
- Do not duplicate React's orchestration by calling `document.startViewTransition()` around the same navigation.
- Preserve the distinction between initial typed publication and later Suspense reveals; applications can give later reveals their own boundaries.
- Provide an explicit policy for reduced motion, UA-managed visual transitions, and HMR; do not silently suppress Server Function refreshes or application animation choices.
- Keep this optional behavior in core and preserve document-navigation fallback when the required navigation APIs are unavailable.

### Acceptance before release

- Test actual application-owned boundaries first, then optional Layer defaults and scoped overrides, in the development host and independently served production output.
- Observe real animation creation and completion, not only calls to mocked `addTransitionType`.
- Cover push, replace, backward/forward traversal, unavailable/equal history indices, custom link types, reserved names, and absence of custom-type replay on traversal.
- Verify outgoing/incoming policy, route parameter identity, nested boundaries, and no unrelated Layout remounts.
- Verify first UI commit versus delayed Flight EOF and Suspense reveals, Server Function refresh, HMR, cancellation, and rapidly superseded navigation.
- Verify SSR/hydration, reduced motion, UA visual transitions, and unsupported-browser document navigation.
- Add public policy API documentation only after its actual contract is implemented and tested.

### Evidence and limits

Source inspection confirms existing notifications and link handling, and existing client integration tests cover the router protocol with controlled React/browser collaborators.
Those tests do not prove browser animations or Layer-driven animation behavior.
The earlier SSR probe proves HTML rendering only, not animation support.
Actual animation acceptance and the proposed policy API remain deferred; this revision changes the plan, not runtime behavior.

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
