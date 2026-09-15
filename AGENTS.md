# Effront

## Repository structure

- `packages/effront/`: application and Fetch runtime (`effront`).
- `packages/vite/`: portable build integration (`@effront/vite`).
- `packages/cloudflare/`: Cloudflare Vite integration (`@effront/cloudflare`) and separate runtime accessors (`@effront/cloudflare/workers`).
- `packages/markdown/`: Vite glob collections and comark React SSR rendering (`@effront/markdown`).
- `examples/markdown/`: file-relative Markdown routing and asset consumer.
- `examples/workers/`: consumer using the public package exports, Workers `fetch`, and runtime `env`.
- `app/docs/`: SSR Guide, API reference, and implementation architecture site, using the framework itself with shadcn/ui and Tailwind Typography.
- `tests/e2e-build/`: independent Playwright acceptance against its package-local fixture built for standalone Wrangler.
- `tests/e2e-dev/`: independent Vite/workerd HMR acceptance using its own minimal package-local fixture.
- `packages/gitignore-patterns/`: Gitignore generator and its colocated unit / package-owned Vitest CLI integration tests.
- `docs/`: current architecture and verification documentation.
- Removed upstream implementations and references remain available in Git history, not in the working tree.

Workspace discovery uses `app/*`, `packages/*`, `tests/*`, and `examples/*`, without per-project entries.

## Development commands

### Execution rules

- Work in this independent repository at `workspace/packages/effront/`, not the parent virtual monorepo.
- Push and create pull requests only in `totto2727-org/effront`, as authorized by the user. Never target the upstream repository. Do not publish packages or deploy without explicit authorization.
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
- Run `vp run test` from `tests/e2e-build/` for built-artifact browser acceptance and from `tests/e2e-dev/` for development HMR acceptance.
- Run `vp run test` from `packages/gitignore-patterns/` for that package's unit and real CLI integration tests.

For the documentation site, enter `app/docs/` and use `vp dev`, `vp build`, or `vp run local`; see [site operations](docs/DOCS-SITE.md).
The site has colocated content and rendering tests; framework browser acceptance uses the independent E2E fixtures rather than starting this site.

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
- Use `Effect.fnUntraced` for framework internals to avoid tracing overhead. Use `Effect.fn` for application code, examples, consumer-facing documentation, and public authoring API tests so applications retain tracing. Keep `Effect.fn.Return` where a generator return type is needed; it is type-only.
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

Each of `tests/e2e-build/` and `tests/e2e-dev/` owns its fixture, Playwright configuration, Vite configuration, and `vp run test` entry point.
Keep one fixed `webServer` command per package: build then standalone Wrangler for `e2e-build`, and Vite development for `e2e-dev`.
The dev package covers HMR only. Do not introduce shared build/dev mode branches or start both hosts from either package.
Run the fixed package-local fixture directly. Keep fixture copying, dynamic run directories, and concurrent-run isolation out of Playwright configuration; HMR tests restore their own file changes in `finally`.

## npm publication

- `.github/workflows/ci.yml` runs checks and tests for pull requests and `main` updates.
- `.github/workflows/publish.yml` publishes on pushes to `main`, including merged pull requests, using the template's shared Nix, TypeScript, and npm actions on `@main`.
- Publication is serialized and skips versions already on npm. Bump each changed public package's version in its pull request and update workspace peer ranges through `vp install --lockfile-only` when needed. There is no automatic version bump or tag trigger.
- Public packages are `effront`, `@effront/vite`, `@effront/cloudflare`, and `@effront/markdown`. `@effront/gitignore-patterns` is local development tooling and is not included in this release workflow.
- The packages ship TypeScript sources for Vite/RSC processing. `.github/actions/pack-npm` uses `vp pm pack` to resolve `workspace:` and `catalog:` protocols, then stages the exact source archives under ignored `tmp/npm/` for the shared Bun publisher. Do not replace this with bundled `vp pack` output without reviewing RSC module directives and public exports.
- The public packages start at stable version `0.1.0` and use public access with the `latest` dist-tag through `publishConfig`.
- Before merging the publishing workflow, the package owner must ensure all four npm packages exist and configure each Trusted Publisher for GitHub owner `totto2727-org`, repository `effront`, workflow `publish.yml`, and direct publication. No GitHub environment is configured. Initial publication, if required by npm, must be performed by the owner.
- The workflow uses GitHub-hosted runners and job-scoped `id-token: write`, without long-lived npm tokens. Protect `main` and require the CI check before merging. Local checks and dry runs do not verify registry trust or package ownership.
- Reference: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [shared publish action](https://github.com/totto2727-org/monorepo/blob/main/.github/actions/publish-npm/action.yaml).
