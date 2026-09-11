import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { ersc } from "effective-rsc/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    ersc(),
    cloudflare({
      configPath: fileURLToPath(new URL("./wrangler.jsonc", import.meta.url)),
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
      remoteBindings: false,
      persistState: false,
    }),
  ],
  // Wrangler only uploads modules inside the Worker output directory.
  environments: { ssr: { build: { outDir: "./dist/rsc/ssr" } } },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
