import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.js"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 1,
        statements: 1,
        functions: 1,
        branches: 1
      }
    }
  }
});
