import { resolve } from "node:path";
import { defineConfig } from "vite";

const fromRoot = (...segments: string[]): string => resolve(__dirname, ...segments);

export default defineConfig({
  ssr: {
    external: ["pg"]
  },
  build: {
    target: "node24",
    ssr: true,
    outDir: fromRoot("dist-simulation/full-game-matrix"),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        "full-game-matrix": fromRoot("tools/debug/src/full-game-20p-matrix/cli.ts"),
        "full-game-matrix-merge": fromRoot("tools/debug/src/full-game-20p-matrix/merge-cli.ts")
      },
      external: (id) => id === "pg" || id.startsWith("pg/") || id.startsWith("node:"),
      output: {
        entryFileNames: "[name].mjs",
        chunkFileNames: "chunks/[name]-[hash].mjs",
        format: "es"
      }
    }
  }
});
