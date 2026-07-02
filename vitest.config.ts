import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test runner for the client-side analytics. The bulk of the suite is pure,
 * synchronous, model-based math (no DOM, no network), so the default `node`
 * environment keeps it fast to run after edits (`npm test`). The handful of
 * React hook/component tests opt into jsdom per-file with a
 * `// @vitest-environment jsdom` docblock, so they get a DOM without slowing the
 * pure suite down. `@vitejs/plugin-react` provides the JSX/TSX transform (React
 * 19 automatic runtime); the `@/*` alias mirrors tsconfig so tests import the
 * same way the app does.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
