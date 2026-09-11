# effective-rsc Workers migration

## Repository structure

- `packages/effective-rsc/`: active fetch-based framework and Vite integration.
- `examples/workers/`: active consumer using the public package exports, Workers `fetch`, and runtime `env`.
- `tests/`: end-to-end acceptance against the real consumer.
- `vendor/`: read-only upstream references. Never edit or import from them.
- Original Bun/Rspack examples, deployment packages, scripts, and fixtures are retained for comparison but excluded from the active workspace.

## Development commands

### Execution rules

- Work on this independent clone, not the parent virtual monorepo.
- Do not create PRs, push commits, publish packages, or deploy to Cloudflare. The user requested local implementation and local Git history only.
- Use VitePlus for formatting, linting, checks, package management, and test entry points.
- Formatting follows the parent workspace's default VitePlus baseline. Lint rules stay at VitePlus defaults. Do not restore the upstream custom Effect/Oxlint rules or add unrelated lint overrides.
- Keep temporary evidence under this repository's ignored `tmp/` directory. Never commit `.dev.vars` or real secrets.
- Local acceptance must not require Cloudflare authentication or remote services.

### Standard tasks

From the repository root:

- `vp install` installs the pinned pnpm workspace dependencies.
- `vp run dev` runs the real Workers consumer through the Cloudflare Vite plugin.
- `vp run build` produces the consumer's Worker and client assets.
- `vp run local` serves the generated Worker using Wrangler locally without Vite.
- `vp fmt` formats with VitePlus.
- `vp lint` uses default VitePlus lint rules.
- `vp run typecheck` checks the active TypeScript graph.
- `vp test run` runs active unit/integration tests.
- `vp run test:e2e` runs real browser acceptance.

For direct Vite commands, enter `examples/workers/` and use `vp dev` or `vp build`.
The root `vite.config.ts` owns repository formatting, linting, and test configuration.

## Architecture

### Authorized migration

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
- **Effect**: read `vendor/effect/LLMS.md` before editing Effect code.

## Package-specific rules

- Keep dependency versions in the shared catalog only when at least two active manifests reference them.
- Preserve explicit public package subpaths rather than exporting internal modules indiscriminately.
- Use path-qualified Effect service identifiers. Keep shared runtime contracts implementation-free.
- Use typed failures for input and I/O errors, and plain `TypeError` only for violated wiring invariants.
- Do not count a build, mock, or copied-source test as proof that the public Workers fetch path works. Test both `vp dev` and the Vite-independent Wrangler artifact.

_This AGENTS.md was generated from the [share-artifact skill](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/SKILL.md) and [AGENTS template](https://raw.githubusercontent.com/totto2727-org/agent/refs/heads/main/plugins/totto2727-coding/skills/share-artifact/agents/template.md)._
