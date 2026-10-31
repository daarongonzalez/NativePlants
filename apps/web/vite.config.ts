import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
  server: {
    // The Nativo illustrations live at the repo root in design/nativo.
    fs: { allow: ["../.."] },
  },
});
