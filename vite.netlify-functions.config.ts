import { resolve } from "node:path";
import { defineConfig } from "vite";

const fromRoot = (...segments: string[]): string => resolve(__dirname, ...segments);

export default defineConfig({
  ssr: {
    external: ["pg"]
  },
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
    target: "node20",
    ssr: true,
    outDir: fromRoot("netlify/functions"),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: fromRoot("apps/server/src/netlify/gameplay-slice-function.ts"),
      external: (id) => id === "pg" || id.startsWith("pg/") || id.startsWith("node:"),
      output: {
        entryFileNames: "gameplay-slice.mjs",
        format: "es",
        inlineDynamicImports: true
      }
    }
  }
});
