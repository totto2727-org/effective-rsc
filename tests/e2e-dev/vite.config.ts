import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: process.env["EFFRONT_E2E_APP_ROOT"],
  plugins: [effront(), effrontCloudflare({ inspectorPort: false, persistState: false })],
});
