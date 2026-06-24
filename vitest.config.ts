import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test runner for the client-side analytics. Everything under test is pure,
 * synchronous, model-based math (no DOM, no network), so the default `node`
 * environment is all that's needed — keeping the suite fast to run after edits
 * (`npm test`). The `@/*` alias mirrors tsconfig so tests can import the same
 * way the app does.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
