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
      }
    ]
  },
  build: {
    outDir: fromRoot("netlify/functions"),
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: fromRoot("apps/server/src/netlify/gameplay-slice-function.ts"),
      formats: ["es"],
      fileName: () => "gameplay-slice.mjs"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
