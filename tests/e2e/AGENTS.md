# Effront E2E project

## Ownership

This private workspace project owns one `playwright.config.ts`, one `vite.config.ts`, a dedicated application in `fixtures/app/`, browser tests, and test artifacts.
Use public Effront package exports in the fixture instead of importing application code from `examples/` or `app/docs/`.
Keep the fixture focused on framework contracts rather than duplicating the documentation site's article catalog.

## Commands

After `vp install` at the workspace root, enter this directory.
Install Chromium with `vp exec playwright install chromium` if needed.

- `vp run test` runs the single Playwright configuration.
- `vp exec playwright test --project=build` selects normal browser acceptance against the built Wrangler artifact.
- `vp exec playwright test --project=dev` selects development-only HMR checks.
- `vp check` checks this package's configuration, fixture, and test source.

The `build` and `dev` projects have explicit, separate startup commands and test selection.
Playwright's `webServer` configuration is global, so project selection filters tests but does not automatically filter the configured servers.
Do not add a custom runner, parse Playwright's CLI arguments, or introduce per-test-file Vite/Playwright configurations to work around that behavior.
Use `.e2e.ts` for browser suites so standard Vitest discovery remains unchanged.

## Isolation and lifecycle

- Playwright owns server startup, readiness, and process-group shutdown after success or failure.
- Each invocation allocates two OS-selected ports and its own ignored `tmp/run-*` directory.
- Build output, development source copies, Wrangler state, results, and traces belong to that run directory.
- HMR tests modify only the per-run development copy, never fixture originals, examples, or the documentation application.
- The fixture uses the public Vite and Cloudflare plugins; the Cloudflare plugin owns nested SSR output placement.
- The build host uses the generated Wrangler configuration with local test-only binding overrides.
- The client graph audit is a test helper, not a production plugin.
- `reuseExistingServer: false` avoids silently testing an unrelated running server.
- Internal `EFFRONT_E2E_*` environment variables preserve the invocation's paths and ports when Playwright evaluates configuration in workers.
- No deployment, account, remote binding, or real secret is required.

See [test boundaries](../../docs/TESTING.md) for the division between package tests and browser acceptance.
