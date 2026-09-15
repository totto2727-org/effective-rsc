# Effront Workers

## Repository structure

- `packages/effront/`: application and Fetch runtime (`effront`).
- `packages/vite/`: portable build integration (`@effront/vite`).
- `packages/cloudflare/`: Cloudflare Vite integration (`@effront/cloudflare`) and separate runtime accessors (`@effront/cloudflare/workers`).
- `packages/markdown/`: Vite glob collections and comark React SSR rendering (`@effront/markdown`).
- `examples/markdown/`: file-relative Markdown routing and asset consumer.
- `examples/workers/`: consumer using the public package exports, Workers `fetch`, and runtime `env`.
- `app/docs/`: SSR Guide, API reference, and implementation architecture site, using the framework itself with shadcn/ui and Tailwind Typography.
- `tests/e2e/`: independently managed Playwright acceptance against the real consumer.
- `packages/gitignore-patterns/`: Gitignore generator and its colocated unit / package-owned Vitest CLI integration tests.
- `docs/`: current architecture and verification documentation.
- Removed upstream implementations and references remain available in Git history, not in the working tree.

Workspace discovery uses `app/*`, `packages/*`, `tests/*`, and `examples/*`, without per-project entries.

## Development commands

### Execution rules

- Work on this independent clone, not the parent virtual monorepo.
- Push and create pull requests only in `totto2727-org/effective-rsc`, as authorized by the user. Never target the upstream repository. Do not publish packages or deploy without explicit authorization.
- Use VitePlus for formatting, linting, checks, package management, and test entry points.
- Formatting follows the parent workspace's default VitePlus baseline. Lint rules stay at VitePlus defaults. Do not restore the upstream custom Effect/Oxlint rules or add unrelated lint overrides.
- Keep temporary evidence under this repository's ignored `tmp/` directory. Never commit `.dev.vars` or real secrets.
- Local acceptance must not require Cloudflare authentication or remote services.

### Standard tasks

From the repository root:

- `vp install` installs the pinned pnpm workspace dependencies.
- `vp run fix` applies formatting and safe lint fixes through `js:fix` (`vp check --fix`).
- `vp run check` verifies formatting, default lint rules, and types through `js:check` (`vp check`).
- `vp run test` runs retained unit/integration tests through `js:test` (`vp test run`).
- Root task definitions live in `vite.config.ts` `run.tasks`, not duplicated package scripts.
- Do not add standalone formatter/linter tasks; use the fix/check workflow.
- Run `vp run test` from `tests/e2e/` for real browser acceptance.
- Run `vp run test` from `packages/gitignore-patterns/` for that package's unit and real CLI integration tests.

For the documentation site, enter `app/docs/` and use `vp dev`, `vp build`, or `vp run local`; see [site operations](docs/DOCS-SITE.md).
Run `vp run test:docs` from `tests/e2e/` for its independent browser acceptance.

To run the example, enter `examples/workers/` and use `vp dev`, `vp build`, or `vp run local`.
The repository root intentionally provides no example dev, build, or local-hosting script.
The root `vite.config.ts` owns repository formatting, linting, and test configuration.

## Architecture

### Runtime boundary

The user's 2026-09-11 requirements explicitly supersede the upstream Bun-only runtime, Rspack compilation, proprietary development server, Vercel packaging, and Bun verification commands.
The common boundary is a Web `Request` to `Response` handler. The initial host is Cloudflare Workers.
Workers-specific `env` and execution context stay behind the host adapter and in request-local Effect context, never implicitly in Flight or HTML.
D1, KV, R2, database abstractions, Node/Bun host adapters, and hosted deployments are outside the current scope.

### Graphs and lifetimes

- Keep browser, RSC, SSR, and tooling graphs explicit. Only the RSC graph resolves React's `react-server` condition.
- RSC and SSR execute in workerd through Cloudflare child environments. Do not fall back to Node SSR in development.
- Scope application services to the request, and preserve their lifetime through response body completion, error, and cancellation.
- Preserve React's native RSC and Server Function protocols. Do not invent a replacement transport.
- Use the generated Wrangler config for built-local execution. Do not ask Wrangler to compile unprocessed RSC source.

## Development tools

- **VitePlus**: unified tooling with the Vite core and Vitest versions pinned in `pnpm-workspace.yaml`.
- **Cloudflare Vite plugin / Wrangler**: local Workers runtime only.
- **Playwright**: browser validation of actual built and development applications.
- **Effect**: consult the installed version's source and official documentation before changing Effect APIs.
- Keep all retained source and tests covered by root checks. Do not hide legacy files behind tooling exclusions.

## Test placement

- Place unit tests next to their implementation as `<module>.test.ts` or `<module>.test.tsx`.
- Reserve `tests/` for integration or black-box contracts spanning multiple modules or external tools.
- Use standard Vitest discovery without a root `test.include` override.
- Name Playwright browser suites `*.e2e.ts` and select them in the Playwright configuration so Vitest does not collect them.
- Keep colocated tests in source checks, but exclude them from shipped source packages and declaration builds.
- See [test boundaries](docs/TESTING.md) for the retained integration suites.

## Package-specific rules

- Keep dependency versions in the shared catalog only when at least two active manifests reference them.
- Preserve explicit public package subpaths rather than exporting internal modules indiscriminately.
- Use path-qualified Effect service identifiers. Keep shared runtime contracts implementation-free.
- Use typed failures for input and I/O errors, and plain `TypeError` only for violated wiring invariants.
- Do not count a build, mock, or copied-source test as proof that the public Workers fetch path works. Test both `vp dev` and the Vite-independent Wrangler artifact.

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._

## Public documentation audience

- Write common Guide pages for npm package consumers, not contributors cloning this repository.
- Describe Effront as a React meta-framework built on Web standards and Effect; distinguish extensible Fetch boundaries from tested adapter support.
- Keep conceptual guides host-neutral. Getting started may choose a concrete host and must include a complete runnable configuration; put deeper host-specific details in Platforms.
- Prefer affirmative instructions and working examples over statements of what something is not. Reserve negative warnings for necessary correctness, compatibility, or safety constraints.
- Architecture > Implementation chapters explain the current packages/effront implementation. Display the reviewed package version and commit, and keep embedded source excerpts synchronized with both that baseline and current files; validate them locally; retain upstream provenance separately in docs/UPSTREAM.md.
- Deferred features belong in docs/ROADMAP.md and must not be presented as implemented APIs.

Run `vp run test` from `tests/e2e/` for framework browser acceptance using one Playwright configuration and one Vite configuration.
The `build` project validates the built Wrangler application; the `dev` project covers HMR using an isolated fixture copy.
Keep their startup commands explicit rather than selecting between dev and build commands by test file or array index.
