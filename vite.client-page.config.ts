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
      }
    ]
  },
  build: {
    outDir: fromRoot("page-assets/js/client-assets"),
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: fromRoot("apps/client/src/browser/gameplay-slice-page.ts"),
      name: "EmpireGameplaySliceClient",
      formats: ["iife"],
      fileName: () => "gameplay-slice-client.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
