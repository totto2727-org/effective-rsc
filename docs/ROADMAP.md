# Effront roadmap

This document records planned work, not available APIs or supported-host guarantees.

## Page View Transitions

Status: deferred by user request on 2026-09-12. Implement after the current documentation work, not as part of it.

### Proposed direction

- Add a `PageViewTransition` Effect service and Layer for application defaults and page/route-scoped overrides.
- Resolve an explicit priority order: page override, nearest route scope, application default, disabled.
- Pass only serializable resolved configuration across Flight, not Effect runtime objects or arbitrary callbacks.
- Apply React `ViewTransition` at changing page boundaries while preserving shared Layout state.
- Reuse the existing router's `startTransition`, `addTransitionType`, navigation direction, and link-specific transition types.
- Keep navigation distinct from Server Function refreshes and HMR, respect reduced motion, and preserve ordinary navigation in unsupported browsers.
- Keep this feature in core, without platform-specific logic.

### Acceptance before release

- Verify actual animations in the development host and independently served production output, including forward/back navigation.
- Verify default Layer settings, scoped overrides, outgoing/incoming settings, route parameter identity, and no unrelated Layout remounts.
- Verify Flight/SSR/hydration compatibility, cancelled or rapid navigation, native browser transitions, reduced motion, and unsupported-browser fallback.
- Add public API documentation only after its actual contract is implemented and tested.

### Evidence and limits

The installed React Canary exposes `ViewTransition` and `addTransitionType`; a direct SSR probe returned ordinary HTML.
The router already tags React transitions, but an integrated public PageViewTransition API and actual browser animation acceptance are not implemented or verified.

References: [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [ViewTransition](https://react.dev/reference/react/ViewTransition), [addTransitionType](https://react.dev/reference/react/addTransitionType).

## Server runtime adapters

Status: planned; Node and Bun server adapters will be designed separately.

- Keep `src/entry.client.ts` as the application definition export.
- Use `src/entry.workers.ts` as the Web Fetch export and the default Vite RSC entry.
- Vite + Cloudflare consumes `entry.workers.ts` directly.
- For future Node/Bun hosts, add `src/entry.server.ts` that imports the export from `entry.workers.ts` and adapts requests, responses, and lifecycle handling to the server runtime.
- Keep server startup and runtime-specific adaptation outside the reusable Fetch entry.
- Validate streaming, cancellation, request context, static assets, and server startup/shutdown through each real adapter before documenting it as supported.
