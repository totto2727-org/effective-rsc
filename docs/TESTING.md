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

The root `tests/gitignore-patterns.mjs` validates the public generator through actual Git and VitePlus CLI processes.
The root `tests/workers-fetch.e2e.ts` validates the actual browser application through Vite/workerd and standalone Wrangler.
Playwright explicitly selects the `.e2e.ts` suite, keeping it outside Vitest's standard `.test`/`.spec` discovery without a Vitest include override.

## Verification

- `vp test run` discovers both colocated unit tests and retained integration tests by default.
- `vp run typecheck` checks all source and retained tests, including the colocated files.
- `vp run test:ignore` builds the generator and executes real formatter/linter acceptance.
- `vp run test:e2e` builds the Workers example and runs the real browser acceptance matrix.
- Package archives must omit colocated tests; source-package file exclusions and the generator declaration-build exclusions enforce that boundary, not test-discovery exclusions.

## Observed migration results (2026-09-12)

Standard discovery passed all 28 files and 171 tests: 17 colocated suites and 11 retained integration suites.
Formatting, linting, type checking, real Gitignore CLI acceptance, and all nine Workers browser checks passed.
Both package archives were inspected and contained no unit, integration, or browser test files.
