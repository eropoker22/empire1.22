import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const rootDirectory = resolve(process.cwd());
const artifactDirectory = resolve(rootDirectory, ".tmp", "release-tools");
const bundledGeneratorPath = resolve(
  artifactDirectory,
  `generate-browser-gameplay-config-${process.pid}.mjs`
);

await mkdir(artifactDirectory, { recursive: true });

let exitCode = 1;
try {
  await build({
    entryPoints: [resolve(rootDirectory, "scripts", "generate-browser-gameplay-config.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundledGeneratorPath,
    logLevel: "silent"
  });
  const result = spawnSync(process.execPath, [bundledGeneratorPath, ...process.argv.slice(2)], {
    cwd: rootDirectory,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} finally {
  await rm(bundledGeneratorPath, { force: true }).catch(() => undefined);
}

process.exit(exitCode);
