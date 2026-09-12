import { generateIgnorePatterns } from "@effront/gitignore-patterns";
import { defineConfig } from "vite-plus";

// Regenerate effective exclusions from reachable .gitignore files on every config load.
const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  run: {
    tasks: {
      check: { command: "", dependsOn: ["js:check"] },
      fix: { command: "", dependsOn: ["js:fix"] },
      test: { command: "", dependsOn: ["js:test"] },
      "js:check": { command: "vp check", cache: false },
      "js:fix": { command: "vp check --fix", cache: false },
      "js:test": { command: "vp test run", cache: false },
    },
  },
  fmt: { ignorePatterns },
  lint: { ignorePatterns, options: { typeAware: true, typeCheck: true } },
});
