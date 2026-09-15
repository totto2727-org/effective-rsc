import { fileURLToPath } from "node:url";
import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL("./fixture", import.meta.url)),
  plugins: [effront(), effrontCloudflare({ inspectorPort: false, persistState: false })],
});
