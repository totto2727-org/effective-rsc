# effective-rsc for Workers

An experimental, Effect-native React Server Components framework running natively on Cloudflare Workers.
This local fork preserves the history of [nikhilsnayak/effective-rsc](https://github.com/nikhilsnayak/effective-rsc) while replacing its active Bun/Rspack path with VitePlus, the Vite RSC plugin, and Cloudflare's Vite plugin.
Bun and containers are not required.

## Requirements

- Node.js compatible with VitePlus and the VitePlus `vp` command.
- Dependencies pinned in `pnpm-workspace.yaml` and `pnpm-lock.yaml`, including React Canary and Effect v4 RC.
- Local workerd support on your platform.

The active workspace contains `packages/effective-rsc` and `examples/workers` only.
Other upstream examples and tooling remain for comparison and are not supported by this fork.

## Run locally

From the repository root:

```sh
vp install
vp run dev
```

Open <http://127.0.0.1:5173>.
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

```ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { ersc } from "effective-rsc/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  environments: { ssr: { build: { outDir: "./dist/rsc/ssr" } } },
  plugins: [
    ersc(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
});
```

`ersc()` owns the RSC and React plugins, so do not register those plugins a second time.
It uses `src/worker.ts` as the default RSC input and supports `rsc` and `application` path options.
Cloudflare configuration remains application-owned.
See `examples/workers/vite.config.ts` for the complete runnable configuration.

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

[Workers architecture](../../docs/WORKERS.md) is authoritative for the active fork.
Other architecture documents describe the upstream design unless explicitly updated for Workers.

## License

MIT, as in the upstream repository.
