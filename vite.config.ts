import { defineConfig } from "vite-plus";
import rsc from "@vitejs/plugin-rsc";

// Match the workspace baseline: default VitePlus formatting and lint rules.
// The original Bun/Rspack applications and read-only references are inactive.
const inactive = [
  "vendor/**",
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
  plugins: [rsc({ serverHandler: false })],
  fmt: { ignorePatterns: inactive },
  lint: { ignorePatterns: inactive },
  resolve: {
    conditions: ["react-server"],
  },
  test: {
    include: [
      "packages/effective-rsc/tests/server/workers.test.tsx",
      "packages/effective-rsc/src/vite.test.ts",
    ],
  },
});
