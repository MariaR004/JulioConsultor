import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  site: "https://julioconsultor.com.br",
  vite: {
    build: {
      assetsInlineLimit: 0
    }
  }
});
