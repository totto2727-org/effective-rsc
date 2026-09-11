# Workers implementation verification

Verified locally on 2026-09-11, macOS arm64.
Repository: `../effective-rsc-workers`, branch `workers-fetch`.
The upstream history is preserved from `ed886996d1d3780b94166af4f798c53416d547c8`.

## Requirement-to-evidence mapping

| Requirement                                       | Check and observed result                                                                                                                                                                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers-native runtime without Bun or a container | Real workerd execution passed through Cloudflare's Vite plugin and through Wrangler `dev --local --no-bundle`.                                                                                                                                  |
| Public Workers Fetch entry                        | The example imports `createFetchHandler` through `effective-rsc/workers` and exports `{ fetch }`; both hosts returned successful HTML and Flight responses.                                                                                     |
| Development server with runtime environment       | `workers-dev` passed all 3 Playwright cases and rendered `APP_LABEL` from the configured Workers variables.                                                                                                                                     |
| Wrangler local hosting independent of Vite        | The runner stopped Vite before starting Wrangler against generated `dist/rsc/wrangler.json`; `workers-wrangler-default` passed all 3 cases.                                                                                                     |
| Runtime env changes without rebuilding            | The same build was started again with `APP_LABEL` and `SERVER_TOKEN` overrides; `workers-wrangler-overridden` passed all 3 cases and rendered the changed label and secret-presence indicator.                                                  |
| No implicit secret serialization                  | HTML, Flight, the rendered body, and a nonempty set of actually loaded browser scripts did not contain the test secret.                                                                                                                         |
| Client hydration and navigation                   | Chromium changed the actual button from `Count: 0` to `Count: 1`, followed About, and returned home on both hosts.                                                                                                                              |
| Development updates                               | A separate browser smoke check changed the Client Component label to `Clicks: 1` through Vite HMR without restarting the server; the source was restored afterward.                                                                             |
| HTTP behavior                                     | HTML and Flight content types, `private, no-store`, `Vary: Accept`, and a 404 for an unknown route passed in all 3 host configurations.                                                                                                         |
| Request isolation and lifecycle                   | The public Fetch adapter test passed per-request Layer acquisition, overlapping env isolation, original request/execution-context identity, EOF disposal, bodyless disposal before return, cancellation exactly once, and stream-error cleanup. |
| VitePlus formatter and linter                     | `vp fmt --check` passed; `vp lint` reported 0 warnings and 0 errors with its 96 default rules. The root config adds ignore patterns, not custom style or lint rules.                                                                            |
| Type safety of active workflow                    | `vp run typecheck` passed for the active example, reachable framework code, Fetch test, Playwright config, and browser test source.                                                                                                             |
| New sibling directory, local changes only         | Implementation is in the cloned sibling directory with local commits. No PR, push, publishing, or cloud deployment was performed.                                                                                                               |

## Reproduce

```sh
vp install
vp fmt --check
vp lint
vp run typecheck
vp test run
vp run test:e2e
```

Final coordinator execution of `vp run test:e2e` exited with status 0.
It ran the real build followed by 9 passing browser cases: 3 development, 3 default Wrangler, and 3 overridden Wrangler.
The focused Fetch test is one scenario containing the lifecycle and isolation assertions listed above and passed with `vp test run`.
These adapter checks complement, rather than replace, the real Workers browser acceptance path.

## Integration defects found and fixed

- Request environment must be provided to both Layer acquisition and the request handler's Effect context.
- Vite's RSC optimizer needs the RSC plugin as a direct dependency of the consuming workspace package.
- Worker-first asset routing must not intercept Vite's virtual client bootstrap or built JavaScript assets.
- SSR must build inside `dist/rsc/ssr`, not sibling `dist/ssr`, because Wrangler only attaches modules within the Worker output directory.
  The final RSC bundle imports `./ssr/index.js`, and Wrangler reported attaching `ssr/index.js` plus its supporting modules before returning HTTP 200.

## Artifact audit and cleanup

The final RSC, nested SSR, and client output contained 13 JavaScript, JSON, and CSS files.
Scanning those files found zero matches for `bun:`, `Bun.`, `@effect/platform-bun`, `react-server-dom-rspack`, or `@rspack`.
This static check is supplementary evidence; the workerd acceptance run establishes actual runtime behavior.
The obsolete sibling SSR output from earlier experiments was removed.
The acceptance environment file was removed and ports 5173, 5174, 8787, and 8788 were confirmed closed after verification.

## Scope of this evidence

This verifies the requested local Fetch/env workflow, not every preserved upstream feature or a production deployment.
D1 and other storage integrations, Node/Bun host adapters, and cloud deployment remain explicitly outside this milestone.
The retained upstream CLI, old build pipeline, old examples, and old integration suites are inactive.
This is a local Vite source-package consumer, not a published npm package certification.
