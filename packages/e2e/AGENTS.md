# Workers E2E project

## Ownership

This private workspace project owns Playwright configuration, browser tests, standard Playwright webServer lifecycle settings, test-only environment files, and browser reports.
The application under test remains at `../../examples/workers` and is referenced directly.
Do not duplicate its source into this project.

## Commands

After running `vp install` at the workspace root, enter this directory.
If Chromium is not installed yet, run `vp exec playwright install chromium` here.

- `vp run test` invokes `playwright test`, which starts Vite/workerd and standalone Wrangler with default and overridden bindings through `webServer`.
- `vp check` checks this project's TypeScript with its own strictest-based configuration.

The `test` script intentionally runs the Playwright E2E workflow, not the built-in `vp test` Vitest command.
Browser suites use `.e2e.ts`, which the package's Playwright configuration selects and ordinary Vitest discovery does not.
Keep the root workspace free of Playwright configuration and E2E scripts.

## Local resources

- Playwright owns server startup, HTTP readiness, and process-group shutdown after success or failure.
- Each invocation selects three OS-assigned HTTP ports and creates its own `tmp/run-*` directory for builds, Wrangler state, results, and failure traces.
- `reuseExistingServer: false` prevents testing an unrelated existing development server; a rare port-allocation race fails instead of reusing that server.
- `vite.host.config.ts` points at the unchanged example source and uses the public Cloudflare factory, but overrides build paths, inspector, and persistence solely for test-host isolation.
- Each Wrangler variant builds into its own directory before starting, avoiding shared-output races and cross-server startup dependencies.
- `fixtures/empty.env` prevents the standalone Wrangler hosts from loading local environment files; overridden values are test-only CLI arguments, not build-time values.
- Configuration workers inherit the invocation's selected ports and output directory through `EFFRONT_E2E_*` variables. Do not set these internal variables in normal use.
- Temporary output remains ignored under this project for diagnosis and may be removed after the run ends.
- No cloud deployment, account, remote binding, or real secret is required.

See [the workspace test boundaries](../../docs/TESTING.md) and [Workers validation](../../docs/WORKERS-VALIDATION.md) for coverage and expected behavior.
