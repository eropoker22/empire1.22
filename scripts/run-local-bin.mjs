import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const [, , specifier, ...args] = process.argv;

if (!specifier) {
  console.error("Missing module specifier.");
  process.exit(1);
}

let resolved;

try {
  resolved = require.resolve(specifier, {
    paths: [process.cwd()]
  });
} catch {
  const localBinPath = path.join(process.cwd(), "node_modules", specifier);
  if (existsSync(localBinPath)) {
    resolved = localBinPath;
  } else {
    console.warn(`Skipped: missing local dependency for ${specifier}. Run npm install to enable this gate.`);
    process.exit(0);
  }
}

const result = spawnSync(process.execPath, [resolved, ...args], {
  cwd: process.cwd(),
  stdio: "inherit"
});

process.exit(result.status ?? 1);
