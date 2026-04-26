import { resolve } from "node:path";
import { defineConfig } from "vite";

const fromRoot = (...segments: string[]): string => resolve(__dirname, ...segments);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@empire\/shared-types$/,
        replacement: fromRoot("packages/shared-types/src/index.ts")
      },
      {
        find: /^@empire\/shared-types\/(.*)$/,
        replacement: fromRoot("packages/shared-types/src/$1")
      },
      {
        find: /^@empire\/game-core$/,
        replacement: fromRoot("packages/game-core/src/index.ts")
      },
      {
        find: /^@empire\/game-core\/(.*)$/,
        replacement: fromRoot("packages/game-core/src/$1")
      },
      {
        find: /^@empire\/game-config$/,
        replacement: fromRoot("packages/game-config/src/index.ts")
      },
      {
        find: /^@empire\/game-config\/(.*)$/,
        replacement: fromRoot("packages/game-config/src/$1")
      },
      {
        find: /^@empire\/tools-debug$/,
        replacement: fromRoot("tools/debug/src/index.ts")
      },
      {
        find: /^@empire\/tools-debug\/(.*)$/,
        replacement: fromRoot("tools/debug/src/$1")
      },
      {
        find: /^@empire\/tools-seed$/,
        replacement: fromRoot("tools/seed/src/index.ts")
      },
      {
        find: /^@empire\/tools-seed\/(.*)$/,
        replacement: fromRoot("tools/seed/src/$1")
      }
    ]
  },
  build: {
    rollupOptions: {
      input: {
        admin: fromRoot("pages/admin.html")
      }
    }
  }
});
