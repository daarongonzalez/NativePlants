import { defineConfig } from "vitest/config";

// Tests cover plain logic only, so they skip the Cloudflare and React Router plugins.
export default defineConfig({
  test: { include: ["app/**/*.test.ts"] },
});
