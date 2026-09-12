# Effront

Effront is a React meta-framework built on Web standards and Effect.
Its Request/Response and Web Stream boundaries are designed for integration with execution environments and existing frameworks through compatible host adapters.
This describes an integration boundary, not a claim that every host or bundler is supported.

## Application model

Build an application from one `Application.effront()` identity using Page, Layout, Routes, Component, Middleware, and Server Function.
Provide required services with the application's Effect Layer.
The runtime keeps request resources alive until the response body completes, fails, or is cancelled.
RSC produces Flight, SSR produces initial HTML, and the browser hydrates and navigates the application.
Routed Pages cross-fade by default while shared Layouts retain their state.
Import `PageViewTransition` from `effront` and provide `Layer.succeed(PageViewTransition, config)` using Effect for application settings, or use `Page.make({ viewTransition: config, render })` for a page override.
Set `viewTransition: false` to disable a page's animation.
Reduced-motion preferences also suppress framework page animations.

## Package boundaries

- `effront`: application APIs and the Fetch runtime.
- `@effront/vite`: RSC/SSR/browser build integration and the native React Compiler.
- Host adapters add execution-environment integration separately.

`src/entry.client.ts` exports the application definition, usually from `application.tsx`.
`src/entry.workers.ts` exports the Web Fetch handler used directly by the Vite + Cloudflare host.
The Vite integration provides browser hydration and SSR entry points.
The application definition is not a browser-only module despite the client entry filename.

## Typed host context

```ts
import { createWorkersContextAccessors } from "effront/workers";

type Env = { APP_LABEL: string };
type HostContext = { requestId: string };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<
  Env,
  HostContext
>();
```

Use `yield* getWorkersEnv()` or `yield* getWorkersRequestContext()` in a request Effect.
Factories read the same request-scoped Context without creating a new Layer or validating the host values.
Omitting types leaves Env and ExecutionContext unknown; the standalone generic getters remain available.
For Cloudflare's execution context, use the Env-only factory from `@effront/cloudflare/workers`.

## Documentation

- Common guides cover application structure, routing, components, services, and testing.
- Host setup and supported environments are isolated under the site's **Platforms** section.
- [Host architecture and current support](../../docs/WORKERS.md) documents the implemented adapter rather than imposing its setup on every application.
- [Roadmap](../../docs/ROADMAP.md) records planned host adapters and completed page-transition support.
- The Architecture > Implementation chapters explain the current application model, request lifecycle, rendering, navigation, and Server Functions.
- [Upstream provenance](../../docs/UPSTREAM.md) preserves the original version and commit records.

The core currently uses the Vite RSC runtime protocol; alternative build integrations are not claimed to work without additional integration.
The `internal/*` exports support matching integration packages and are not application authoring APIs.

## Installation

In a VitePlus-managed application, install from the npm registry:

```sh
vp add effront
vp add -D @effront/vite @vitejs/plugin-rsc
```

Use React and Effect versions compatible with the installed package's peer dependencies.
Add the host adapter described in the Platforms documentation, then start your application with `vp dev`.

Repository development and browser acceptance commands are documented in [the contributor instructions](../../AGENTS.md), not prerequisites for consuming the package.

Effront retains the history and licensing of [effective-rsc](https://effective-rsc.nikhilsnayak.dev/).
