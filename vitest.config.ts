import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Match the tsconfig "@/*" → repo-root alias so lib modules resolve under Vitest.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // DB-backed integration tests make many sequential round-trips to remote Neon.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
