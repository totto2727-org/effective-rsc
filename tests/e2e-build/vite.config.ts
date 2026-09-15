import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { acceptanceAudits } from "./support/client-graph";

export default defineConfig({
  root: process.env["EFFRONT_E2E_APP_ROOT"],
  plugins: [
    effront(),
    effrontCloudflare({ inspectorPort: false, persistState: false }),
    acceptanceAudits(),
  ],
});
