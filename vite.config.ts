import { defineConfig } from "vite-plus";

// Match the workspace baseline: default VitePlus formatting and lint rules.
const generated = [
  "tmp/**",
  "**/.wrangler/**",
  "**/dist/**",
  "**/node_modules/**",
  "coverage/**",
  "playwright-report/**",
  "test-results/**",
];

export default defineConfig({
  fmt: { ignorePatterns: generated },
  lint: { ignorePatterns: generated },
  test: {
    include: ["packages/effective-rsc/tests/**/*.test.{ts,tsx}"],
  },
});
