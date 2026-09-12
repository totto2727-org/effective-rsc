# Effront roadmap

This document records planned work, not available APIs or supported-host guarantees.

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
