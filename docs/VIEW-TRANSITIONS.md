# Page ViewTransition validation

## Contract

Effront adds a React ViewTransition boundary around each routed Page by default, outside the Page's content and inside its shared Layouts.
The native router's commit and Flight stream lifecycle are unchanged.
Configuration resolves built-in defaults, the `PageViewTransition` Effect reference, and `Page.make({ viewTransition })` in that order.
Each supplied property overrides its predecessor; transition-type maps are replaced rather than deep-merged.
A page can disable its boundary with `viewTransition: false`, or re-enable an application-level opt-out with `enabled: true`.
The outgoing and incoming pages keep their own settings.

## Observed checks

- Root `vp run check` passes formatting, lint, and types.
- Root `vp run test` passes 308 tests in 41 files, including configuration defaults, partial overrides, per-request isolation, static and parameterized pages, SSR output, and reduced-motion selection.
- The real documentation suite passes 10 cases against Vite dev and an independently started Wrangler production artifact, including no-JavaScript SSR, Flight, hydration, navigation, typography, mobile sidebar, and exact architecture excerpts.
- The Workers example passes 36 browser cases across Vite dev and two independently built Wrangler hosts: default/custom/link-selected animations, history navigation, page opt-out, reduced motion, live preference changes with input value and focus preservation, simulated missing ViewTransition API, direct stylesheet loading, retained Layout, and the existing Fetch cases.
- Final Workers artifacts: `tmp/legacy-e2e-20260915/run-YdQKNS/test-results`.
- Browser animation assertions observe `document.getAnimations()` on animation frames, including pseudo-elements, running progress, and actual opacity/transform keyframes. They do not replace `startViewTransition` or infer success from callbacks alone.
- Local `pnpm pack` includes the public configuration module and client boundary, and excludes colocated tests. No package was published.

## Integration corrections

Setting every ViewTransition class to `none` still allowed a native root fade in the initial reduced-motion implementation.
Removing the React boundary fixed that fade but a real controlled input lost its value on a live OS-preference change.
The final implementation keeps the boundary stable, disables its classes, and suppresses only native root pseudo-element animations under reduced motion.
Both directions of the preference change preserve input value and focus in the final browser suite.
The example's global stylesheet was moved to a rendered Client Component so Vite's RSC CSS graph includes custom animation CSS in both development and built output.

## Evidence boundaries

Browser acceptance uses Chromium and local workerd hosts, not a Cloudflare deployment or a cross-browser compatibility claim.
Configuration and SSR tests are supporting evidence, not proof of visual animation.
HMR and UA transition-type mappings are checked as configuration behavior; no OS-level UA gesture animation claim is made.
The framework does not add animation callbacks or transport them through Flight.
Explicitly changing enabled adds or removes the boundary and may reset page-local state; this differs from changing OS motion preferences, which retains the boundary.
Native Navigation API fallback remains the existing router contract.

References: [React ViewTransition](https://react.dev/reference/react/ViewTransition), [React addTransitionType](https://react.dev/reference/react/addTransitionType).
