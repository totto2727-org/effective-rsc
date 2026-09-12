# Effront rename and plugin boundaries

## Current public surface

The framework package is `effront`, located at `packages/effront`.
Workspace support packages use the `@effront` scope.
The source checkout directory remains `effective-rsc-workers`; its location is not a package identifier.
The application factory is `Application.effront()`.
Existing upstream URLs, copyrights, licenses, fixed comparison commits, and historical Git excerpt strings retain their original names.
No package was published and no remote repository was renamed.

Workers applications register the portable core and the host adapter separately:

```ts
import { effront } from "effront/vite";
import { effrontCloudflare } from "effront/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [effront(), effrontCloudflare()],
});
```

`effront()` owns the React and Vite RSC plugins, application alias, framework entries, and compiler default.
`effrontCloudflare()` owns only the Cloudflare plugin and its required RSC/SSR environment and output-layout configuration.
The adapter does not invoke or import the core plugin.
Cloudflare options are forwarded directly, without a nested `cloudflare` options object.
Normal development leaves `persistState`, `remoteBindings`, server ports, and other ordinary Cloudflare/Vite settings at their defaults.
Only the isolated E2E hosts disable persistence and the inspector.
Future Node/Bun host adapters can omit `effrontCloudflare()`, but this change does not implement those adapters or claim a working Node/Bun host.

## Native React Compiler

The installed `@vitejs/plugin-react` version is `6.1.1`.
Its native compiler option defaults to disabled; Effront explicitly enables `react({ compiler: true })`.
The required `oxc-transform-react` dependency resolves to `0.145.0` and is shipped as a framework tooling dependency rather than relying on a consumer's accidental installation.
This uses the plugin's experimental Rust implementation, not a Babel fallback.
The official plugin compiles client environments, leaving the SSR and RSC server-consumer environments outside client memoization.

The permanent test `packages/effront/tests/vite/compiler.test.ts` passes the real example Counter through Vite's actual transformation pipeline using only the public `effront()` plugin.
It observes compiler-runtime imports, the memo-cache sentinel, and cache-slot access, while the compiler-disabled control preserves the Counter without those transformations.
The same resolved core configuration contains no Cloudflare plugin and preserves the `react-server` condition only in the RSC environment.
Server transforms retain SSR code and RSC client references without client memoization.
These transformation checks do not execute server modules or substitute Node SSR for workerd acceptance.

The normal example production build also emitted a compiled Counter in its real client entry chunk.
The Counter allocates three memo-cache slots, caches its click handler with `Symbol.for("react.memo_cache_sentinel")`, and reuses the rendered button when its count is unchanged.
Actual Chromium counter updates and navigation passed through Vite/workerd and both independently built Wrangler variants.

Official references:

- [Vite React plugin and React Compiler](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#react-compiler).
- [Oxc](https://oxc.rs/).
- [VitePlus integrated checks](https://viteplus.dev/guide/check).

## Observed acceptance

- `vp check` passed formatting, default lint rules, and integrated TypeScript checking.
- The complete Vitest suite passed after the rename and native compiler integration.
- The real Workers example suite passed all nine cases across Vite development, default Wrangler bindings, and overridden Wrangler bindings.
- The real documentation suite passed all ten cases across Vite development and standalone Wrangler, including initial SSR, dark mode, navigation, highlighting, exact pinned diff text, and Effront document titles.
- The built documentation client graph contains neither Shiki nor the native build-time React compiler implementation.
- A local `vp pm pack` tarball contained all 53 intended source/document/license files, every exported target, and the native compiler dependency, with no tests or obsolete authoring filenames.
- The immutable reading snippet object and all its reproduction commands remained byte-identical to the pre-rename revision.
- Root, framework, and documentation third-party license files remained byte-identical.
- The viewing server was restored on `http://127.0.0.1:5173/` and returned HTTP 200 with an Effront title.

Historical validation records remain historical rather than being rewritten to pretend that earlier commands used the new package names.
Temporary build logs, packed artifacts, and browser screenshots remain ignored inside this repository.
