import { generateIgnorePatterns } from "@effective-rsc/gitignore-patterns";
import { defineConfig } from "vite-plus";

// Regenerate effective exclusions from reachable .gitignore files on every config load.
const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  fmt: { ignorePatterns },
  lint: { ignorePatterns },
  test: {
    include: ["packages/*/tests/**/*.test.{ts,tsx}"],
  },
});
