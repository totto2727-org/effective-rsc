# @effront/cloudflare

Cloudflare Workers integration for Effront, with a Vite plugin and typed request-context accessors.
Install alongside `@effront/vite`, `effront`, and VitePlus.
The Cloudflare Vite plugin is owned as a dependency of this package.

## Usage

```ts
import { defineConfig } from "vite-plus";
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

`effrontCloudflare()` does not register `effront()` automatically.
It configures the `rsc` Worker environment and its `ssr` child, nesting default SSR output inside the Worker upload directory.
Explicit SSR output overrides are preserved.
Other Cloudflare options are forwarded directly, except the invariant `viteEnvironment` wiring.
Persistence, remote bindings, server ports, and Wrangler configuration discovery keep Cloudflare defaults.

The Fetch handler remains in `effront/workers`; the `@effront/cloudflare/workers` subpath supplies runtime accessors without importing the Vite plugin.

## Typed request context

```ts
import { createWorkersContextAccessors } from "@effront/cloudflare/workers";

type Env = { APP_LABEL: string };
export const { getWorkersEnv, getWorkersRequestContext } = createWorkersContextAccessors<Env>();
```

Inside a request Effect, use `yield* getWorkersEnv()` or `yield* getWorkersRequestContext()`.
The factory accepts only Env and fixes the execution context to `CloudflareExecutionContext`, whose contract is `{ waitUntil(promise: Promise<unknown>): void }`.
The same subpath exports ready-to-use `getWorkersEnv<Env>()` and `getWorkersRequestContext<Env>()`; omitted Env defaults to unknown.
All accessors read the existing core request Context, so application factories share the same request-scoped Layer and preserve object identity.
Types describe the host values; use application validation when runtime guarantees are required.
For both custom Env and ExecutionContext types, use `createWorkersContextAccessors<Env, ExecutionContext>()` from `effront/workers`.

## Validation

Run `vp check` and `vp test run` in this package.
Real Vite and independent Wrangler browser acceptance lives in `tests/e2e`.
