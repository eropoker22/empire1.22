import { basename, isAbsolute, relative, resolve } from "node:path";
import { defineConfig } from "vite";

const fromRoot = (...segments: string[]): string => resolve(__dirname, ...segments);
const configuredOutputDirectory = String(
  process.env.EMPIRE_LOCAL_HOSTED_RUNTIME_OUT_DIR ?? ""
).trim();
const runtimeArtifactRoot = fromRoot(".tmp", "local-hosted-full");
const outputDirectory = configuredOutputDirectory
  ? resolve(configuredOutputDirectory)
  : fromRoot("dist-local-hosted-runtime");
const relativeOutputDirectory = relative(runtimeArtifactRoot, outputDirectory);

if (configuredOutputDirectory && (
  !relativeOutputDirectory
  || relativeOutputDirectory === ".."
  || relativeOutputDirectory.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  || isAbsolute(relativeOutputDirectory)
  || basename(outputDirectory) !== "runtime-bundle"
)) {
  throw new Error(
    "EMPIRE_LOCAL_HOSTED_RUNTIME_OUT_DIR must target a runtime-bundle directory under .tmp/local-hosted-full."
  );
}

export default defineConfig({
  ssr: {
    external: ["pg"]
  },
  build: {
    target: "node24",
    outDir: outputDirectory,
    emptyOutDir: true,
    copyPublicDir: false,
    ssr: true,
    rollupOptions: {
      input: {
        "database-migrations": fromRoot("scripts/database-migrations.ts"),
        "bootstrap-admin-user": fromRoot("scripts/bootstrap-admin-user.ts"),
        "generate-browser-gameplay-config": fromRoot("scripts/generate-browser-gameplay-config.ts"),
        "hosted-dev-http": fromRoot("apps/server/src/bootstrap/hosted-dev-http-cli.ts"),
        "hosted-runtime-worker": fromRoot("apps/server/src/bootstrap/hosted-runtime-worker-cli.ts"),
        "hosted-e2e-scenario": fromRoot("tools/seed/hosted-e2e-scenario.mjs")
      },
      output: {
        entryFileNames: "[name].mjs",
        chunkFileNames: "chunks/[name]-[hash].mjs",
        format: "es"
      },
      external: (id) => id === "pg" || id.startsWith("pg/") || id.startsWith("node:")
    }
  }
});
