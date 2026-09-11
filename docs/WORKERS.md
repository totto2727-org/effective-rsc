# Workers architecture

This document describes the Workers framework and its Vite integration.
The upstream base is `ed886996d1d3780b94166af4f798c53416d547c8`.

## Goal

Expose a Workers-native Fetch handler and run the same application in Cloudflare's Vite development environment and Wrangler's local built-output host.
D1 and other storage integrations are intentionally deferred by the user.
No container, Bun process, cloud deployment, PR, or npm publishing is required.

## Runtime boundaries

```mermaid
flowchart TD
  Host[Workers fetch request / env / executionContext] --> Adapter[effective-rsc/workers createFetchHandler]
  Adapter --> Context[Request-scoped Effect context and application Layer]
  Context --> HTTP[Effect HttpRouter.toWebHandler]
  HTTP --> RSC[RSC graph: application and Flight rendering]
  RSC --> SSR[SSR graph: renderHtml]
  RSC --> Flight[Flight Web stream]
  SSR --> HTML[HTML Web stream with embedded Flight]
  HTML --> Browser[Client graph: hydration and navigation]
  Flight --> Browser
```

`createFetchHandler` creates the application Layer for each request, not once globally.
This permits Layer acquisition to access the current environment and avoids sharing request-specific resources across Workers requests.
Both Layer acquisition and the handler's Effect context receive the same Workers context.
The response body's EOF, error, or cancellation owns request-scope disposal.

`getWorkersEnv<Env>()` and `getWorkersRequestContext<Env, ExecutionContext>()` retrieve typed host values without copying them into a serialization format.
The latter exposes `request`, `env`, and `executionContext`.
Type arguments are caller assertions, not validation of runtime bindings.
Developers remain responsible for not explicitly rendering secrets or passing bindings into Client Components.

The RSC graph imports `@vitejs/plugin-rsc/rsc/server`.
HTML rendering loads the separate SSR entry with `import.meta.viteRsc.loadModule("ssr", "index")`.
Only the Flight Web stream and rendering options cross that boundary, not the environment or execution context.
The SSR graph uses the edge-compatible React DOM renderer and the plugin's SSR Flight client.
The browser graph uses the plugin's browser Flight client and hydration entry.

## Host and build ownership

`effective-rsc/vite` exports `ersc()` and owns the RSC and React plugins.
Applications must not register those plugins twice.
The default RSC entry is the application's `src/worker.ts`, which exports the Workers Fetch object.
The framework provides the SSR and browser entries.
Cloudflare's plugin remains application-owned with `viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }`.

VitePlus drives Vite and builds the graph-specific outputs.
Wrangler runs the generated `examples/workers/dist/rsc/wrangler.json` using `--local --no-bundle`.
The consumer sets `environments.ssr.build.outDir` to `./dist/rsc/ssr` so every dynamically loaded SSR module resides inside Wrangler's Worker upload root.
Emitting SSR as a sibling `dist/ssr` builds successfully but fails in Wrangler at runtime because that module is not attached to the Worker.
Workers assets are host-owned, not Bun filesystem middleware.
The example's Cloudflare configuration owns the assets binding and runtime variables.
Changing Wrangler runtime variables must not require rebuilding the application.

The package exposes TypeScript source exports for Vite bundling.
The workspace consumer exercises the actual `effective-rsc`, `effective-rsc/vite`, and `effective-rsc/workers` export map.
This is not a claim of standalone unbundled Node compatibility or published-package readiness.

## Tooling

`vite.config.ts` at the repository root owns formatting, lint, and unit-test configuration.
Formatting and lint rules use VitePlus defaults, matching the source monorepo's baseline formatting.
Ignore patterns only exclude dependencies and generated or temporary output.
The workspace contains the framework and its Workers example.

## Verification contract

- `vp run typecheck` checks every retained framework source file, the consumer, and test source.
- `vp test run` checks the retained framework tests, including the public Fetch adapter's request-context and lifecycle behavior.
- `vp run test:e2e` builds the real example, starts VitePlus development mode, and then starts Wrangler against the same build with default and overridden variables.
- Browser checks cover HTML, Flight, hydrated interaction, navigation, unknown routes, and secret non-disclosure.
- Successful compilation alone does not establish Workers runtime or hydration correctness.

[Observed verification results](WORKERS-VALIDATION.md) map each requirement to its completed local checks.

## Scope

The upstream CLI, Bun server/filesystem hosting, Rspack build machinery, development panel/RPC, Vercel adapter, obsolete examples, and vendored research snapshots have been removed.
Their history is preserved by Git.
Node and Bun can eventually host the same Fetch interface through host adapters, but no adapter or compatibility guarantee is delivered in this milestone.
D1, KV, R2, authentication integrations, and production deployment remain outside the user's requested scope.

## Official references

- [Effect HttpRouter source](https://github.com/Effect-TS/effect-smol/blob/main/packages/effect/src/unstable/http/HttpRouter.ts)
- [Vite RSC plugin](https://github.com/vitejs/vite-plugin-rsc)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Workers Fetch handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
- [Wrangler local development](https://developers.cloudflare.com/workers/development-testing/)
- [VitePlus](https://viteplus.dev/)
