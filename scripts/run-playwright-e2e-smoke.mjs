import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PLAYWRIGHT_PORT || 4174);
const baseURL = `http://${HOST}:${PORT}`;
const healthURL = `${baseURL}/api/servers`;
const defaultSpecs = [
  "tests/e2e/login-smoke.spec.js",
  "tests/e2e/onboarding-smoke.spec.js",
  "tests/e2e/entry-flow.spec.js",
  "tests/e2e/game-flow.spec.js"
];
const specs = process.argv.slice(2).length ? process.argv.slice(2) : defaultSpecs;

const env = {
  ...process.env,
  PLAYWRIGHT_E2E_BASE_URL: baseURL,
  PLAYWRIGHT_E2E_HEALTH_URL: healthURL,
  PLAYWRIGHT_E2E_HOST: HOST,
  PLAYWRIGHT_E2E_PORT: String(PORT)
};

function killProcessTree(processRef) {
  if (!processRef?.pid) {
    return;
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(processRef.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  processRef.kill("SIGTERM");
}

async function waitForHealth(timeoutMs = 240_000) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthURL);
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`E2E web server did not become healthy at ${healthURL}: ${lastError}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: options.stdio || "inherit",
      windowsHide: true
    });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    child.on("error", () => resolve(1));
  });
}

const server = spawn(process.execPath, [
  "scripts/run-local-bin.mjs",
  "vite/bin/vite.js",
  "--config",
  "vite.game.config.ts",
  "--host",
  HOST,
  "--port",
  String(PORT)
], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  windowsHide: true
});

let exitCode = 1;
try {
  await waitForHealth();
  exitCode = await runCommand(process.execPath, [
    "scripts/run-local-bin.mjs",
    "playwright/cli.js",
    "test",
    ...specs
  ], {
    stdio: "inherit"
  });
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  exitCode = 1;
} finally {
  killProcessTree(server);
}

process.exit(exitCode);
