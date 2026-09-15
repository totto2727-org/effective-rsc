# Test boundaries

Unit tests live beside their implementation as `<module>.test.ts` or `<module>.test.tsx`.
The root Vite configuration does not override Vitest's test inclusion patterns.
Moving the tests preserves their assertions and changes only module-relative imports.

## Retained integration suites

The following suites remain under `packages/effront/tests/` because they exercise interactions across module or tool boundaries:

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
| `vite/cloudflare.test.ts`              | Real Vite configuration resolution integrating Effront and Cloudflare plugins.            |

The package-owned `packages/gitignore-patterns/tests/cli.test.ts` validates the public generator under Vitest through actual Git and VitePlus CLI processes.
The build E2E package validates its dedicated fixture application through the generated Wrangler artifact.
The separate dev E2E package runs only HMR checks against Vite/workerd with its own minimal fixture.
Playwright explicitly selects the `.e2e.ts` suite, keeping it outside Vitest's standard `.test`/`.spec` discovery without a Vitest include override.

## Verification

- `vp test run` discovers both colocated unit tests and retained integration tests by default.
- `vp check` checks all source and retained tests, including the colocated files.
- `(cd packages/gitignore-patterns && vp run test)` builds the generator and executes real formatter/linter acceptance.
- `(cd tests/e2e-build && vp run test)` runs browser acceptance against the built fixture hosted by standalone Wrangler.
- `(cd tests/e2e-dev && vp run test)` runs only development HMR checks against its minimal fixture.
- Package archives must omit colocated tests; source-package file exclusions and the generator declaration-build exclusions enforce that boundary, not test-discovery exclusions.

## Observed migration results (2026-09-12)

This is a historical validation record from before the Effront rename. Its recorded output and package identifiers remain unchanged.

Standard discovery passed all 28 files and 171 tests: 17 colocated suites and 11 retained integration suites.
Formatting, linting, type checking, real Gitignore CLI acceptance, and all nine Workers browser checks passed.
Both package archives were inspected and contained no unit, integration, or browser test files.

## Independent test ownership

`tests/e2e-build` and `tests/e2e-dev` each own their Playwright dependency, configuration, standard webServer settings, browser suites, and generated reports.
Each application lives in its package's `fixture/`, uses public package exports, and does not import or modify the examples or documentation site.
The dev fixture contains only what its HMR checks need.
From either package, `vp run test` runs that package's browser suite; `vp check` checks configuration, fixture, and test source.
The root package has no E2E runner script or Playwright dependency.

`packages/gitignore-patterns` owns both `src/index.test.ts` and `tests/cli.test.ts`.
The latter uses Vitest's parameterized tests, lifecycle hooks, and assertions while running real Git and VitePlus subprocesses.
Both suites test the current source, avoiding stale compiled-code results, and all temporary fixtures are created and removed inside the owning package's ignored `tmp/`.
Standard root Vitest discovery also includes these package tests, but never the `.e2e.ts` browser suites.

After separation, root Vitest discovery passed 29 files and 176 tests, the generator package alone passed 2 files and 16 tests, and the independent E2E project passed all nine browser cases.
Package-local test fixtures were removed by their lifecycle cleanup.

## Standard E2E server lifecycle

Each E2E package uses Playwright's [webServer](https://playwright.dev/docs/test-webserver) for startup, readiness, and shutdown.
Each has one Vite configuration and one fixed `webServer` command, with no build/dev mode branch or shared multi-host configuration.
The build package runs `vp build` followed by standalone Wrangler with test binding overrides.
The dev package runs `vp dev` and tests only HMR.
Each invocation copies its package-local fixture into an ignored `tmp/run-*` directory and selects one available HTTP port.
Build output, Wrangler state, and failure traces remain within that package's run directory.
The HMR suite changes the per-run fixture copy, leaving authored fixtures, examples, and the documentation site unchanged.
Run the packages independently with their own `vp run test` commands.

## Task entry points

Root task definitions follow the reference monorepo's `vite.config.ts` `run.tasks` structure.
Use `vp run fix`, `vp run check`, and `vp run test`, delegating to `js:fix`, `js:check`, and `js:test` respectively.
The implementation commands are `vp check --fix`, `vp check`, and `vp test run`; format/lint configuration and rules are unchanged.
These tasks disable caching so checks, fixes, and tests always examine the current filesystem, including newly created files.
App-local dev/build and the independently owned E2E tasks remain package-local.
The Gitignore CLI integration tests still invoke individual tool commands internally to prove each tool's exclusion behavior; those are test subjects, not user-facing workflow tasks.

Validated the real task interface with a temporary source probe: `check` rejected malformed formatting, `fix` repaired it, `check` then passed, and a separate TypeScript mismatch caused `check` to fail before the restored source passed again.
`vp run test` passed all 241 tests across 33 files.
