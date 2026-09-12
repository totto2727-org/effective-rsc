# effront for Workers

An experimental, Effect-native React Server Components framework running natively on Cloudflare Workers.
This local fork preserves the history of [nikhilsnayak/effective-rsc](https://github.com/nikhilsnayak/effective-rsc) while replacing its active Bun/Rspack path with VitePlus, the Vite RSC plugin, and Cloudflare's Vite plugin.
Bun and containers are not required.

## Requirements

- Node.js compatible with VitePlus and the VitePlus `vp` command.
- Dependencies pinned in `pnpm-workspace.yaml` and `pnpm-lock.yaml`, including React Canary and Effect v4 RC.
- Local workerd support on your platform.

The workspace contains `packages/effront`, the tooling utility `packages/gitignore-patterns`, and `examples/workers`.
Obsolete upstream implementations, examples, tooling, and source snapshots have been removed from the working tree and remain available in Git history.

## Run locally

From the repository root:

```sh
vp install
cd examples/workers
vp dev
```

Open the URL reported by Vite (normally <http://localhost:5173>).
This is Vite's development server with the Cloudflare plugin executing the application inside workerd, not a Node or Bun HTTP server emulating Workers.
Example commands run from `examples/workers`; the repository root has no startup wrapper.

To serve a production build locally without Vite, stay in `examples/workers`:

```sh
vp build
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
For example, from `examples/workers`: `vp exec wrangler dev --local --no-bundle --config dist/rsc/wrangler.json --env-file .dev.vars --port 8787`.
Do not put secrets into Vite `define`, `import.meta.env`, Client Component props, or rendered output.

The example reads `APP_LABEL` and reports whether `SERVER_TOKEN` is configured without displaying the token.
Environment values are request-scoped and are not automatically serialized into HTML or Flight.
Application code can still explicitly leak values by rendering or passing them to Client Components.

## Fetch API

`src/entry.client.ts` exports the application defined in `application.tsx`:

```ts
export { default } from "./application";
```

`src/entry.server.ts` exports the host Fetch handler:

```ts
import { createFetchHandler } from "effront/workers";
import application from "./entry.client";

export default {
  fetch: createFetchHandler(application),
};
```

The returned function accepts `(request, env, executionContext)` and returns `Promise<Response>`.
Inside server-side Effect computations:

```ts
import { Effect } from "effect";
import { getWorkersEnv, getWorkersRequestContext } from "effront/workers";

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

Register the portable framework plugin and the independent Cloudflare adapter:

```ts
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

`effront()` owns React, the native React Compiler, Vite RSC, and the default `src/entry.server.ts` and `src/entry.client.ts` entries.
The application entry remains part of the RSC graph, not the browser hydration bootstrap, which the framework supplies.
`effrontCloudflare()` only adds host integration, including the `rsc` Worker environment, `ssr` child environment, and nested SSR output.
Install `@effront/vite` and, for Cloudflare hosts, `@effront/cloudflare` as development dependencies.
The Cloudflare package owns `@cloudflare/vite-plugin`; the core does not depend on Cloudflare or the native compiler.
Other future hosts can omit the Cloudflare adapter.

Run Vite from the application's directory so normal root and Wrangler configuration discovery apply.
No root startup wrapper or framework-specific server host/port settings are required.

`persistState` and `remoteBindings` are not overridden: Cloudflare's normal defaults apply.
The example also omits `assets.run_worker_first`, using Cloudflare's default asset-first routing.
Its application URLs do not collide with static files, so missing assets fall through to the Worker.
Worker-first routing is only needed when an application intentionally wants the Worker to intercept asset requests or take precedence over conflicting asset URLs.
The Vite plugin generates `assets.directory` in the built Wrangler configuration, so it need not be handwritten in the source configuration.
Smart Placement is an optional production setting, not a prerequisite for local development.
Pass Cloudflare options directly to the adapter:

```ts
effrontCloudflare({ configPath: "./wrangler.preview.jsonc" });
```

Override the framework entries separately with `effront({ rsc: "./custom/server.ts", application: "./custom/application.tsx" })`.
The Cloudflare adapter owns its required environment names.

## Quality checks

```sh
vp check
vp test run
cd tests/e2e
vp run test
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
