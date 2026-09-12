import tailwindcss from "@tailwindcss/vite";
import { erscCloudflare } from "effective-rsc/cloudflare";
import { defineConfig } from "vite-plus";

export default defineConfig({ plugins: [erscCloudflare(), tailwindcss()] });
