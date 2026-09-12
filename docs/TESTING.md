# Test boundaries

Unit tests live beside their implementation as `<module>.test.ts` or `<module>.test.tsx`.
The root Vite configuration does not override Vitest's test inclusion patterns.
Moving the tests preserves their assertions and changes only module-relative imports.

## Retained integration suites

The following suites remain under `packages/effective-rsc/tests/` because they exercise interactions across module or tool boundaries:

| Suite                                  | Integration contract                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `application/definition.test.tsx`      | Application definitions, route compilation, RSC rendering, and client route outlets.      |
| `application/duplicate-module.test.ts` | Identity and interoperability across separately loaded framework module instances.        |
| `client/client-router.test.ts`         | Navigation, Flight loading, React commit ordering, and response lifetimes.                |
| `client/call-server.test.ts`           | Server Function invocation, Flight results, route refresh, and browser rendering.         |
| `client/route-loader.test.ts`          | Route loading and cache ownership across FlightClient and navigation.                     |
| `client/route-refresh.test.ts`         | Refresh/navigation coordination and streamed-response ownership through render commits.   |
| `server/flight-html-stream.test.ts`    | HTML injection and client-side reconstruction of embedded Flight streams.                 |
| `server/middleware.test.ts`            | Application middleware acquisition/release through the real Effect HTTP web handler.      |
| `server/workers.test.tsx`              | Application layers, request-scoped bindings, and public Workers Fetch response lifetimes. |
| `types/route-scaling.test.ts`          | Type instantiation scaling through an independently invoked TypeScript compiler.          |
| `vite/cloudflare.test.ts`              | Real Vite configuration resolution integrating ERSC and Cloudflare plugins.               |

The package-owned `packages/gitignore-patterns/tests/cli.test.ts` validates the public generator under Vitest through actual Git and VitePlus CLI processes.
The E2E project's `packages/e2e/tests/workers-fetch.e2e.ts` validates the actual browser application through Vite/workerd and standalone Wrangler.
Playwright explicitly selects the `.e2e.ts` suite, keeping it outside Vitest's standard `.test`/`.spec` discovery without a Vitest include override.

## Verification

- `vp test run` discovers both colocated unit tests and retained integration tests by default.
- `vp run typecheck` checks all source and retained tests, including the colocated files.
- `(cd packages/gitignore-patterns && vp run test)` builds the generator and executes real formatter/linter acceptance.
- `(cd packages/e2e && vp run test)` builds the Workers example and runs the real browser acceptance matrix.
- Package archives must omit colocated tests; source-package file exclusions and the generator declaration-build exclusions enforce that boundary, not test-discovery exclusions.

## Observed migration results (2026-09-12)

Standard discovery passed all 28 files and 171 tests: 17 colocated suites and 11 retained integration suites.
Formatting, linting, type checking, real Gitignore CLI acceptance, and all nine Workers browser checks passed.
Both package archives were inspected and contained no unit, integration, or browser test files.

## Independent test ownership

`packages/e2e` owns its Playwright dependency, configuration, standard webServer settings, test environment file, browser suites, and generated reports.
It references the existing `examples/workers` app without copying or relocating it.
From that package, `vp run test` runs all three local-hosting variants and `vp run typecheck` checks its configuration and test source.
The root package has no E2E runner script or Playwright dependency.

`packages/gitignore-patterns` owns both `src/index.test.ts` and `tests/cli.test.ts`.
The latter uses Vitest's parameterized tests, lifecycle hooks, and assertions while running real Git and VitePlus subprocesses.
Both suites test the current source, avoiding stale compiled-code results, and all temporary fixtures are created and removed inside the owning package's ignored `tmp/`.
Standard root Vitest discovery also includes these package tests, but never the `.e2e.ts` browser suites.

After separation, root Vitest discovery passed 29 files and 176 tests, the generator package alone passed 2 files and 16 tests, and the independent E2E project passed all nine browser cases.
Package-local test fixtures were removed by their lifecycle cleanup.

## Standard E2E server lifecycle

The E2E package uses Playwright's [webServer](https://playwright.dev/docs/test-webserver) for startup, readiness, and shutdown instead of a custom `run.mjs` runner.
The Vite host configuration reuses the example source and public integration plugin while isolating test-only output, inspector, and persistence settings.
Three dynamically selected HTTP ports and one unique run directory keep simultaneous invocations separate.
Both Wrangler hosts build their own isolated artifacts before starting; overrides are applied at Wrangler startup, not during compilation.
See [the E2E project instructions](../packages/e2e/AGENTS.md) for commands and retained diagnostic artifacts.
