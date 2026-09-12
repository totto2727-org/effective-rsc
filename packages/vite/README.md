# @effront/vite

Portable Effront Vite integration for React Server Components, SSR, browser hydration, and the native React Compiler.
Install alongside `effront` and VitePlus.
It does not install or register Cloudflare integration.

## Usage

```ts
import { defineConfig } from "vite-plus";
import { effront } from "@effront/vite";
import { effrontCloudflare } from "@effront/cloudflare";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

For another host, omit `effrontCloudflare()` and provide its host integration separately.
Node and Bun adapters are not implemented yet.

The default entries are `src/entry.workers.ts` for the Fetch host and `src/entry.client.ts` for the application definition export.
Override them with `effront({ rsc, application })`.
The Vite + Cloudflare configuration uses these two entries directly.
Future Node or Bun adapters can use `src/entry.server.ts` either to adapt the Fetch export from `src/entry.workers.ts` or to host the application directly through Effect HTTP with a reusable Runtime.
See [the host adapter roadmap](../../docs/ROADMAP.md#server-runtime-adapters) for that planned integration.
The application definition stays in the RSC graph, while the plugin supplies the browser and SSR entries.
Do not register React or Vite RSC plugins a second time.
The `effront/internal/*` exports are an integration contract with the matching core version, not application APIs.

## Validation

Run `vp check` and `vp test run` in this package.
Real browser and built-Worker acceptance lives in `tests/e2e`.
