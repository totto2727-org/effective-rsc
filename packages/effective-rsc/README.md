# effective-rsc for Workers

An experimental, Effect-native React Server Components framework running natively on Cloudflare Workers.
This local fork preserves the history of [nikhilsnayak/effective-rsc](https://github.com/nikhilsnayak/effective-rsc) while replacing its active Bun/Rspack path with VitePlus, the Vite RSC plugin, and Cloudflare's Vite plugin.
Bun and containers are not required.

## Requirements

- Node.js compatible with VitePlus and the VitePlus `vp` command.
- Dependencies pinned in `pnpm-workspace.yaml` and `pnpm-lock.yaml`, including React Canary and Effect v4 RC.
- Local workerd support on your platform.

The workspace contains `packages/effective-rsc` and `examples/workers`.
Obsolete upstream implementations, examples, tooling, and source snapshots have been removed from the working tree and remain available in Git history.

## Run locally

From the repository root:

```sh
vp install
vp run dev
```

Open the URL reported by Vite (normally <http://localhost:5173>).
This is Vite's development server with the Cloudflare plugin executing the application inside workerd, not a Node or Bun HTTP server emulating Workers.
Alternatively, run `vp dev` directly from `examples/workers`.

To serve a production build locally without Vite:

```sh
vp run build
vp run local
```

Open <http://127.0.0.1:8787>.
Wrangler reads the generated `examples/workers/dist/rsc/wrangler.json`, including its built Worker and asset configuration.
No Cloudflare account, deployment, or container is needed for these local commands.

## Runtime environment

Set ordinary local bindings in `examples/workers/wrangler.jsonc` under `vars`.
For local secrets, copy `examples/workers/.dev.vars.example` to `.dev.vars` in that directory and change the example value.
The `.dev.vars` file is ignored by Git.
For built-output hosting, supply runtime values with Wrangler's `--var` or an explicit `--env-file` path instead of relying on discovery relative to the generated configuration.
For example, from the repository root: `vp exec wrangler dev --local --no-bundle --config examples/workers/dist/rsc/wrangler.json --env-file examples/workers/.dev.vars --port 8787`.
Do not put secrets into Vite `define`, `import.meta.env`, Client Component props, or rendered output.

The example reads `APP_LABEL` and reports whether `SERVER_TOKEN` is configured without displaying the token.
Environment values are request-scoped and are not automatically serialized into HTML or Flight.
Application code can still explicitly leak values by rendering or passing them to Client Components.

## Fetch API

```ts
// src/worker.ts
import { createFetchHandler } from "effective-rsc/workers";
import application from "./application";

export default {
  fetch: createFetchHandler(application),
};
```

The returned function accepts `(request, env, executionContext)` and returns `Promise<Response>`.
Inside server-side Effect computations:

```ts
import { Effect } from "effect";
import { getWorkersEnv, getWorkersRequestContext } from "effective-rsc/workers";

type Env = { APP_LABEL: string; SERVER_TOKEN?: string };
type Context = { waitUntil(promise: Promise<unknown>): void };

const label = Effect.gen(function* () {
  const env = yield* getWorkersEnv<Env>();
  const { request } = yield* getWorkersRequestContext<Env, Context>();
  return { label: env.APP_LABEL, path: new URL(request.url).pathname };
});
```

The type parameters describe your host bindings, not runtime schema validation.
These helpers must run within the request's Effect context.
The application Layer is acquired per request and retained through the response body's lifetime.
The portable HTTP graph uses Effect's `HttpRouter.toWebHandler` rather than a Bun server.
A future Node/Bun adapter can invoke the same Fetch interface, but those adapters are not included here.

## Vite integration

For Cloudflare Workers, the configuration only needs one plugin:

```ts
import { erscCloudflare } from "effective-rsc/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [erscCloudflare()],
});
```

Install `@cloudflare/vite-plugin` in the consuming application alongside the framework and VitePlus.
The Cloudflare dependency is an optional peer of the framework, so non-Cloudflare consumers do not need it.
`erscCloudflare()` composes ERSC, React, Vite RSC, and Cloudflare integration.
Do not register those plugins a second time.
It configures the `rsc` Worker environment, `ssr` child environment, and SSR output inside the Worker upload directory.

Run Vite from the application's directory so its normal root and Wrangler configuration discovery apply.
The repository-root `dev` and `build` scripts do this automatically for `examples/workers`.
No framework-specific `root`, `configPath`, or server host/port settings are necessary in the example.
The acceptance runner supplies its own fixed host, port, and strict-port options solely for automated testing.

`persistState` and `remoteBindings` are not overridden: Cloudflare's normal defaults apply.
The example also omits `assets.run_worker_first`, using Cloudflare's default asset-first routing.
Its application URLs do not collide with static files, so missing assets fall through to the Worker.
Worker-first routing is only needed when an application intentionally wants the Worker to intercept asset requests or take precedence over conflicting asset URLs.
The Vite plugin generates `assets.directory` in the built Wrangler configuration, so it need not be handwritten in the source configuration.
Smart Placement is an optional production setting, not a prerequisite for local development.
To customize Cloudflare configuration, pass its options under `cloudflare`:

```ts
erscCloudflare({
  cloudflare: { configPath: "./wrangler.preview.jsonc" },
});
```

The `rsc` entry and `application` alias options are the same as `ersc()` from `effective-rsc/vite`.
That portable lower-level plugin remains available for other hosts.
The Cloudflare integration owns its required environment names rather than exposing contradictory environment overrides.

## Quality checks

```sh
vp fmt --check
vp lint
vp run typecheck
vp test run
vp run test:e2e
```

Formatting uses the same default VitePlus baseline as the source monorepo.
Lint uses VitePlus's default rules without the upstream custom lint plugin.
The browser acceptance runner exercises both the real development server and the built Worker served by Wrangler.

## Scope and limitations

- This is experimental local implementation work, not a production-stability promise.
- D1, KV, R2, deployment automation, Node/Bun adapters, the old CLI, Bun filesystem hosting, Rspack builds, and the old development panel are not part of the active milestone.
- Client navigation retains the upstream Navigation API requirement, with full-page navigation when unavailable.
- React Canary, Effect RC, Vite RSC, and Workers compatibility require coordinated upgrades.
- The package exposes source entries intended for Vite bundling, not an unbundled Node import or an npm release guarantee.
- No PR, push, cloud deployment, or publishing is performed for this local fork.

## Documentation

[Workers architecture](../../docs/WORKERS.md) describes the framework.
[Verification results](../../docs/WORKERS-VALIDATION.md) record the local acceptance checks.

## License

MIT, as in the upstream repository.
