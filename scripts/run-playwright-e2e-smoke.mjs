import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PLAYWRIGHT_PORT || 4174);
const baseURL = `http://${HOST}:${PORT}`;
const healthURL = `${baseURL}/api/servers`;
const cliArgs = process.argv.slice(2);
const reuseExistingServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";
const runAllSpecs = cliArgs.includes("--all");
const requestedSpecs = cliArgs.filter((arg) => arg !== "--all");
const HEALTH_TIMEOUT_MS = readPositiveIntegerEnv("PLAYWRIGHT_E2E_HEALTH_TIMEOUT_MS", 240_000);
const PLAYWRIGHT_TIMEOUT_MS = readPositiveIntegerEnv(
  "PLAYWRIGHT_E2E_TIMEOUT_MS",
  runAllSpecs ? 900_000 : 600_000
);
const HEALTH_LOG_INTERVAL_MS = 15_000;
const PROCESS_KILL_GRACE_MS = 10_000;
const RECENT_LOG_LIMIT = 80;
const defaultSpecs = [
  "tests/e2e/admin-read-only.spec.js",
  "tests/e2e/login-smoke.spec.js",
  "tests/e2e/onboarding-smoke.spec.js",
  "tests/e2e/entry-flow.spec.js",
  "tests/e2e/game-flow.spec.js",
  "tests/e2e/local-demo-production-chain.spec.js"
];
const specs = runAllSpecs ? [] : requestedSpecs.length ? requestedSpecs : defaultSpecs;

const env = {
  ...process.env,
  PLAYWRIGHT_E2E_BASE_URL: baseURL,
  PLAYWRIGHT_E2E_HEALTH_URL: healthURL,
  PLAYWRIGHT_E2E_HOST: HOST,
  PLAYWRIGHT_E2E_PORT: String(PORT),
  PLAYWRIGHT_SKIP_WEB_SERVER: "1"
};

const serverLogLines = [];
const playwrightLogLines = [];
let stoppingServer = false;
let serverExit = null;

function readPositiveIntegerEnv(name, fallbackValue) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallbackValue;
}

function formatDuration(ms) {
  return `${Math.round(ms / 1000)}s`;
}

function rememberLogLine(lines, line) {
  const normalized = String(line ?? "").trimEnd();
  if (!normalized) {
    return;
  }
  lines.push(normalized);
  if (lines.length > RECENT_LOG_LIMIT) {
    lines.splice(0, lines.length - RECENT_LOG_LIMIT);
  }
}

function attachProcessLogs(processRef, label, lines) {
  const attach = (stream, writer) => {
    if (!stream) {
      return;
    }

    let pending = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      writer.write(chunk);
      pending += chunk;
      const parts = pending.split(/\r?\n/);
      pending = parts.pop() ?? "";
      for (const part of parts) {
        rememberLogLine(lines, `[${label}] ${part}`);
      }
    });
    stream.on("end", () => {
      if (pending) {
        rememberLogLine(lines, `[${label}] ${pending}`);
        pending = "";
      }
    });
  };

  attach(processRef.stdout, process.stdout);
  attach(processRef.stderr, process.stderr);
}

function printRecentLogs(label, lines) {
  if (!lines.length) {
    console.error(`[e2e-smoke] No ${label} output captured.`);
    return;
  }
  console.error(`[e2e-smoke] Last ${Math.min(lines.length, RECENT_LOG_LIMIT)} ${label} lines:`);
  for (const line of lines) {
    console.error(line);
  }
}

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

async function waitForHealth(timeoutMs = HEALTH_TIMEOUT_MS) {
  const startedAt = Date.now();
  let nextStatusLogAt = startedAt;
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    if (serverExit && !stoppingServer) {
      throw new Error(`E2E web server exited before health check passed: code=${serverExit.code ?? "null"} signal=${serverExit.signal ?? "null"}`);
    }

    try {
      const response = await fetch(healthURL);
      if (response.ok) {
        console.log(`[e2e-smoke] Vite health check passed at ${healthURL}.`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }

    if (Date.now() >= nextStatusLogAt) {
      console.log(`[e2e-smoke] Waiting for Vite health ${formatDuration(Date.now() - startedAt)}/${formatDuration(timeoutMs)} (${lastError || "no response yet"}).`);
      nextStatusLogAt = Date.now() + HEALTH_LOG_INTERVAL_MS;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`E2E web server did not become healthy at ${healthURL}: ${lastError}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const label = options.label || command;
    const lines = options.logLines || [];
    let timedOut = false;
    let finished = false;
    let killGraceTimer = null;
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    attachProcessLogs(child, label, lines);

    const complete = (code) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeoutTimer);
      if (killGraceTimer) {
        clearTimeout(killGraceTimer);
      }
      resolve({ code, timedOut });
    };

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      console.error(`[e2e-smoke] ${label} timed out after ${formatDuration(options.timeoutMs || PLAYWRIGHT_TIMEOUT_MS)}. Killing process tree.`);
      killProcessTree(child);
      killGraceTimer = setTimeout(() => complete(124), PROCESS_KILL_GRACE_MS);
      killGraceTimer.unref?.();
    }, options.timeoutMs || PLAYWRIGHT_TIMEOUT_MS);
    timeoutTimer.unref?.();

    child.on("exit", (code, signal) => {
      complete(timedOut ? 124 : code ?? (signal ? 1 : 0));
    });
    child.on("error", (error) => {
      rememberLogLine(lines, `[${label}] spawn error: ${error?.message || String(error)}`);
      complete(1);
    });
  });
}

console.log(`[e2e-smoke] Base URL: ${baseURL}`);
console.log(`[e2e-smoke] Health URL: ${healthURL}`);
console.log(`[e2e-smoke] Playwright timeout: ${formatDuration(PLAYWRIGHT_TIMEOUT_MS)}`);
console.log(`[e2e-smoke] ${runAllSpecs ? "All" : requestedSpecs.length ? "Requested" : "Default"} specs${runAllSpecs ? "" : ` (${specs.length})`}:`);
if (runAllSpecs) {
  console.log("[e2e-smoke] queued spec set: tests/e2e");
} else {
  for (const spec of specs) {
    console.log(`[e2e-smoke] queued spec: ${spec}`);
  }
}

const server = reuseExistingServer ? null : spawn(process.execPath, [
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
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});
if (server) {
  attachProcessLogs(server, "vite", serverLogLines);
  server.on("exit", (code, signal) => {
    serverExit = { code, signal };
    if (!stoppingServer) {
      console.error(`[e2e-smoke] Vite server exited before cleanup: code=${code ?? "null"} signal=${signal ?? "null"}.`);
    }
  });
  server.on("error", (error) => {
    serverExit = { code: 1, signal: null };
    rememberLogLine(serverLogLines, `[vite] spawn error: ${error?.message || String(error)}`);
    if (!stoppingServer) {
      console.error(`[e2e-smoke] Vite server failed to start: ${error?.message || String(error)}.`);
    }
  });
}

let exitCode = 1;
try {
  await waitForHealth();
  const playwrightArgs = [
    "scripts/run-local-bin.mjs",
    "playwright/cli.js",
    "test",
    ...specs
  ];
  console.log(`[e2e-smoke] Running Playwright command: ${process.execPath} ${playwrightArgs.join(" ")}`);
  const result = await runCommand(process.execPath, playwrightArgs, {
    label: "playwright",
    logLines: playwrightLogLines,
    timeoutMs: PLAYWRIGHT_TIMEOUT_MS
  });
  exitCode = result.code;
  if (exitCode !== 0) {
    console.error(`[e2e-smoke] Playwright exited with code ${exitCode}${result.timedOut ? " after timeout" : ""}.`);
    printRecentLogs("Playwright output", playwrightLogLines);
    printRecentLogs("Vite output", serverLogLines);
  }
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  printRecentLogs("Vite output", serverLogLines);
  exitCode = 1;
} finally {
  stoppingServer = true;
  if (server) {
    killProcessTree(server);
  }
}

process.exit(exitCode);
