import { spawn, spawnSync } from "node:child_process";

const childArgs = ["scripts/run-local-bin.mjs", "vite/bin/vite.js", ...process.argv.slice(2)];
const tail = [];
const maxTailLines = 80;

function appendTail(label, chunk) {
  const text = String(chunk || "");
  for (const line of text.split(/\r?\n/u)) {
    if (!line.trim()) {
      continue;
    }
    tail.push(`${label}: ${line}`);
    if (tail.length > maxTailLines) {
      tail.shift();
    }
  }
}

function dump(reason) {
  console.error(`[playwright-web-server] reason: ${reason}`);
  console.error(`[playwright-web-server] command: ${process.execPath} ${childArgs.join(" ")}`);
  console.error(`[playwright-web-server] url: ${process.env.PLAYWRIGHT_E2E_HEALTH_URL || "unknown"}`);
  console.error(`[playwright-web-server] port: ${process.env.PLAYWRIGHT_E2E_PORT || "unknown"}`);
  if (!tail.length) {
    console.error("[playwright-web-server] output tail: <empty>");
    return;
  }
  console.error("[playwright-web-server] output tail:");
  for (const line of tail) {
    console.error(`[playwright-web-server] ${line}`);
  }
}

console.error(`[playwright-web-server] command: ${process.execPath} ${childArgs.join(" ")}`);
console.error(`[playwright-web-server] url: ${process.env.PLAYWRIGHT_E2E_HEALTH_URL || "unknown"}`);

const child = spawn(process.execPath, childArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

child.stdout.on("data", (chunk) => {
  appendTail("stdout", chunk);
  process.stdout.write(chunk);
});

child.stderr.on("data", (chunk) => {
  appendTail("stderr", chunk);
  process.stderr.write(chunk);
});

let exiting = false;

function terminate(signal) {
  if (exiting) {
    return;
  }
  exiting = true;
  dump(signal);
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill(signal);
  }
  setTimeout(() => process.exit(signal === "SIGTERM" ? 143 : 130), 3000).unref();
}

process.on("SIGTERM", () => terminate("SIGTERM"));
process.on("SIGINT", () => terminate("SIGINT"));

child.on("exit", (code, signal) => {
  dump(`child exit code=${code ?? "null"} signal=${signal ?? "null"}`);
  process.exit(code ?? (signal ? 1 : 0));
});

child.on("error", (error) => {
  appendTail("error", error?.stack || error?.message || String(error));
  dump("child error");
  process.exit(1);
});
