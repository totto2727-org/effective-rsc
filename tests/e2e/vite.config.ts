import { fileURLToPath } from "node:url";
import { effrontCloudflare } from "@effront/cloudflare";
import { effront } from "@effront/vite";
import { defineConfig } from "vite-plus";
import { acceptanceAudits } from "./support/client-graph";

export default defineConfig({
  root:
    process.env["EFFRONT_E2E_APP_ROOT"] ??
    fileURLToPath(new URL("./fixtures/app/", import.meta.url)),
  plugins: [
    effront(),
    effrontCloudflare({ inspectorPort: false, persistState: false }),
    acceptanceAudits(),
  ],
});
