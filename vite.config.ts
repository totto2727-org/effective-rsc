import { defineConfig } from "vite-plus";

// Match the workspace baseline: default VitePlus formatting and lint rules.
// The original Bun/Rspack applications and read-only references are inactive.
const inactive = [
  "vendor/**",
  ".github/**",
  "docs/architecture/**",
  "packages/effective-rsc/docs/**",
  "packages/effective-rsc/LLMS.md",
  "packages/effective-rsc/bin/**",
  "packages/effective-rsc/rslib.config.ts",
  "packages/effective-rsc/vitest.config.ts",
  "packages/effective-rsc/src/build/**",
  "packages/effective-rsc/src/dev/**",
  "packages/effective-rsc/src/cli.ts",
  "packages/effective-rsc/src/server/serve.ts",
  "packages/effective-rsc/src/server/start.ts",
  "packages/effective-rsc/src/server/server-config.ts",
  "site/**",
  "fixtures/**",
  "examples/event-platform/**",
  "examples/hello-world/**",
  "packages/vercel/**",
  "packages/create-ersc-app/**",
  "scripts/**",
  "tooling/**",
  "tmp/**",
  "**/.wrangler/**",
  "**/.ersc/**",
  "**/dist/**",
  "**/node_modules/**",
];

export default defineConfig({
  fmt: { ignorePatterns: inactive },
  lint: { ignorePatterns: inactive },
  test: {
    include: [
      "packages/effective-rsc/tests/server/workers.test.tsx",
      "packages/effective-rsc/src/vite.test.ts",
    ],
  },
});
