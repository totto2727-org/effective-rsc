# @effront/cloudflare

Cloudflare Workers integration for Effront, implemented exclusively as a Vite plugin.
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

The Fetch handler remains in `effront/workers`; this package has no runtime Fetch adapter.

## Validation

Run `vp check` and `vp test run` in this package.
Real Vite and independent Wrangler browser acceptance lives in `tests/e2e`.
