# Workers E2E project

## Ownership

This private workspace project owns Playwright configuration, browser tests, the server orchestration script, test-only environment files, and browser reports.
The application under test remains at `../../examples/workers` and is referenced directly.
Do not duplicate its source into this project.

## Commands

After running `vp install` at the workspace root, enter this directory.
If Chromium is not installed yet, run `vp exec playwright install chromium` here.

- `vp run test` builds the example, runs Vite/workerd acceptance, then runs standalone Wrangler with default and overridden bindings.
- `vp run typecheck` checks this project's TypeScript with its own strictest-based configuration.

The `test` script intentionally runs the Playwright E2E workflow, not the built-in `vp test` Vitest command.
Browser suites use `.e2e.ts`, which the package's Playwright configuration selects and ordinary Vitest discovery does not.
Keep the root workspace free of Playwright configuration and E2E scripts.

## Local resources

- `run.mjs` resolves CLI binaries from this project's own dependencies.
- Temporary binding input is created under `tmp/` and removed by the runner.
- Playwright writes ignored results under this project, retaining traces on failure.
- The runner owns its spawned servers and must stop them after success or failure.
- Ports 5174 and 8788 must be available for the sequential acceptance matrix.
- No cloud deployment, account, remote binding, or real secret is required.

See [the workspace test boundaries](../../docs/TESTING.md) and [Workers validation](../../docs/WORKERS-VALIDATION.md) for coverage and expected behavior.
