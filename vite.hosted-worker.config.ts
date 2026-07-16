import { defineConfig } from "vite";

export default defineConfig({
  ssr: {
    external: ["pg"]
  },
  build: {
    target: "node20",
    outDir: "dist-worker",
    emptyOutDir: true,
    ssr: true,
    rollupOptions: {
      input: "apps/server/src/bootstrap/hosted-runtime-worker-cli.ts",
      output: { entryFileNames: "hosted-runtime-worker.mjs", format: "es" },
      external: (id) => id === "pg" || id.startsWith("pg/")
    }
  }
});
