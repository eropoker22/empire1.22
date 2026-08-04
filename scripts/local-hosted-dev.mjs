import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {
  createLocalHostedEnvironment,
  LOCAL_HOSTED_API_ORIGIN,
  LOCAL_HOSTED_COMPOSE_FILE,
  LOCAL_HOSTED_DATABASE_NAME,
  LOCAL_HOSTED_FRONTEND_ORIGIN,
  LOCAL_HOSTED_PID_FILE,
  LOCAL_HOSTED_POSTGRES_CONTAINER,
  LOCAL_HOSTED_RUNTIME_DIRECTORY,
  LOCAL_HOSTED_WORKER_ORIGIN,
  resolveLocalHostedFrontendAccess
} from "./local-hosted/local-hosted-config.mjs";
import { resetLocalHostedTestData } from "./local-hosted/local-hosted-reset.mjs";
import { resolveSupportedNodeExecutable } from "./local-hosted/supported-node-runtime.mjs";

const command = process.argv[2] || "start";
const commandArgs = process.argv.slice(3);
const skipVerification = commandArgs.includes("--skip-verify");
const require = createRequire(import.meta.url);
const runtimeBundleDirectory = path.resolve("dist-local-hosted-runtime");

await loadLocalEnvironment();
const buildSha = git(["rev-parse", "HEAD"]);
const nodeRuntime = resolveSupportedNodeExecutable();
const frontendAccess = resolveLocalHostedFrontendAccess(process.env);
const environment = createLocalHostedEnvironment(process.env, buildSha);

try {
  if (command === "start") await start();
  else if (command === "status") await status();
  else if (command === "logs") await logs();
  else if (command === "stop") await stop({ stopPostgres: true });
  else if (command === "reset-test-data") {
    await ensurePostgres();
    await resetLocalHostedTestData({
      args: commandArgs,
      environment,
      nodeExecutable: nodeRuntime.executable,
      managedRuntimeActive: await isManagedRuntimeActive()
    });
  } else {
    throw new Error(`Unknown local hosted command: ${command}.`);
  }
} catch (error) {
  console.error(`[local-hosted] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

async function start() {
  assertLocalSecrets();
  if (await isManagedRuntimeActive()) {
    throw new Error("Canonical local hosted stack už běží.");
  }
  await assertPortsFree([5173, 8787, 8080]);
  await ensurePostgres();
  console.log(`[local-hosted] Node runtime: ${nodeRuntime.version}.`);
  console.log(`[local-hosted] Database: 127.0.0.1/${LOCAL_HOSTED_DATABASE_NAME}.`);
  runNode([
    resolveModule("vite/bin/vite.js"),
    "build",
    "--config",
    "vite.local-hosted-runtime.config.ts"
  ]);
  runNode([runtimeBundle("database-migrations.mjs")]);
  runNode([runtimeBundle("bootstrap-admin-user.mjs")]);
  runNode([runtimeBundle("generate-browser-gameplay-config.mjs")]);
  runNode([
    resolveModule("vite/bin/vite.js"),
    "build",
    "--config",
    "vite.admin-page.config.ts"
  ]);
  runNode([
    resolveModule("vite/bin/vite.js"),
    "build",
    "--config",
    "vite.client-page.config.ts"
  ]);

  await mkdir(LOCAL_HOSTED_RUNTIME_DIRECTORY, { recursive: true });
  const services = [
    startService("api", [runtimeBundle("hosted-dev-http.mjs")]),
    startService("worker", [runtimeBundle("hosted-runtime-worker.mjs")]),
    startService("frontend", [
      resolveModule("vite/bin/vite.js"),
      "--config",
      "vite.game.config.ts",
      "--host",
      frontendAccess.host,
      "--port",
      "5173",
      "--strictPort"
    ])
  ];
  await writeFile(LOCAL_HOSTED_PID_FILE, JSON.stringify({
    supervisor: process.pid,
    api: services[0].child.pid,
    worker: services[1].child.pid,
    frontend: services[2].child.pid,
    buildSha,
    databaseName: LOCAL_HOSTED_DATABASE_NAME,
    startedAt: new Date().toISOString()
  }, null, 2), "utf8");

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await stopServices(services);
    dockerCompose(["stop", "postgres"], { ignoreFailure: true });
    await rm(LOCAL_HOSTED_PID_FILE, { force: true });
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  try {
    await Promise.all([
      waitForHttp(`${LOCAL_HOSTED_API_ORIGIN}/health`, services[0]),
      waitForHttp(`${LOCAL_HOSTED_WORKER_ORIGIN}/health`, services[1]),
      waitForHttp(`${LOCAL_HOSTED_FRONTEND_ORIGIN}/pages/login.html`, services[2]),
      waitForHttp(`${LOCAL_HOSTED_FRONTEND_ORIGIN}/admin.html`, services[2])
    ]);
    if (!skipVerification) {
      runNode(["scripts/verify-local-hosted-runtime.mjs"]);
    }
    console.log("[local-hosted] READY");
    console.log(`[local-hosted] Hra: ${frontendAccess.origin}/pages/login.html`);
    console.log(`[local-hosted] Admin: ${frontendAccess.origin}/admin.html`);
    console.log("[local-hosted] Ukončení: Ctrl+C nebo npm run dev:local-hosted:stop");
    await Promise.race(services.map(async (service) => {
      const result = await service.exited;
      if (!stopping) throw new Error(`${service.name} neočekávaně skončil (${result.code ?? result.signal}).`);
    }));
  } finally {
    await shutdown();
  }
}

async function status() {
  const state = await readPidState();
  const postgres = dockerInspectHealth();
  console.log(`PostgreSQL ......... ${postgres}`);
  for (const [name, url] of [
    ["Hosted API", `${LOCAL_HOSTED_API_ORIGIN}/health`],
    ["Runtime Worker", `${LOCAL_HOSTED_WORKER_ORIGIN}/health`],
    ["Game frontend", `${LOCAL_HOSTED_FRONTEND_ORIGIN}/pages/login.html`],
    ["Admin", `${LOCAL_HOSTED_FRONTEND_ORIGIN}/admin.html`]
  ]) {
    console.log(`${name.padEnd(20, ".")} ${await httpStatus(url)}`);
  }
  if (!state) {
    console.log("Supervisor .......... STOPPED / unmanaged");
    return;
  }
  for (const name of ["supervisor", "api", "worker", "frontend"]) {
    console.log(`${`PID ${name}`.padEnd(20, ".")} ${isProcessAlive(state[name]) ? `RUNNING (${state[name]})` : "STOPPED"}`);
  }
}

async function logs() {
  await mkdir(LOCAL_HOSTED_RUNTIME_DIRECTORY, { recursive: true });
  for (const name of ["api", "worker", "frontend"]) {
    const logPath = path.join(LOCAL_HOSTED_RUNTIME_DIRECTORY, `${name}.log`);
    console.log(`\n===== ${name.toUpperCase()} · ${logPath} =====`);
    if (!existsSync(logPath)) {
      console.log("Log zatím neexistuje.");
      continue;
    }
    const content = await readFile(logPath, "utf8");
    console.log(content.split(/\r?\n/u).slice(-120).join("\n"));
  }
  console.log("\nPro průběžné sledování otevři uvedené soubory; příkaz nic nemaže.");
}

async function stop({ stopPostgres }) {
  const state = await readPidState();
  if (state) {
    for (const name of ["frontend", "worker", "api"]) stopPid(state[name]);
    if (state.supervisor !== process.pid) stopPid(state.supervisor);
    await rm(LOCAL_HOSTED_PID_FILE, { force: true });
  }
  if (stopPostgres) dockerCompose(["stop", "postgres"], { ignoreFailure: true });
  console.log("[local-hosted] Host procesy a PostgreSQL byly zastaveny; volume zůstalo zachované.");
}

async function ensurePostgres() {
  dockerCompose(["up", "-d", "postgres"]);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    if (dockerInspectHealth() === "healthy") return;
    await delay(1_000);
  }
  throw new Error("PostgreSQL container nedosáhl healthy stavu do 120 sekund.");
}

function startService(name, args) {
  const logPath = path.join(LOCAL_HOSTED_RUNTIME_DIRECTORY, `${name}.log`);
  const log = createWriteStream(logPath, { flags: "w" });
  const child = spawn(nodeRuntime.executable, args, {
    cwd: process.cwd(),
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      log.write(chunk);
      for (const line of chunk.split(/\r?\n/u).filter(Boolean)) {
        console.log(`[${name}] ${line}`);
      }
    });
  }
  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      log.end();
      resolve({ code, signal });
    });
    child.once("error", (error) => {
      log.end();
      resolve({ code: 1, signal: null, error });
    });
  });
  return { name, child, exited };
}

async function stopServices(services) {
  for (const service of [...services].reverse()) {
    if (service.child.exitCode === null) service.child.kill("SIGTERM");
  }
  await Promise.race([
    Promise.all(services.map((service) => service.exited)),
    delay(5_000)
  ]);
  for (const service of services) {
    if (service.child.exitCode === null) stopPid(service.child.pid);
  }
}

async function waitForHttp(url, service) {
  const startedAt = Date.now();
  let last = "no response";
  while (Date.now() - startedAt < 120_000) {
    if (service.child.exitCode !== null) {
      throw new Error(`${service.name} skončil před readiness kontrolou.`);
    }
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`${url} není ready: ${last}.`);
}

function runNode(args) {
  execFileSync(nodeRuntime.executable, args, {
    cwd: process.cwd(),
    env: environment,
    windowsHide: true,
    stdio: "inherit"
  });
}

function runtimeBundle(fileName) {
  return path.join(runtimeBundleDirectory, fileName);
}

function resolveModule(specifier) {
  try {
    return require.resolve(specifier, { paths: [process.cwd()] });
  } catch {
    const fallback = path.resolve("node_modules", specifier);
    if (existsSync(fallback)) return fallback;
    throw new Error(`Lokální modul ${specifier} nebyl nalezen.`);
  }
}

function dockerCompose(args, { ignoreFailure = false } = {}) {
  try {
    execFileSync("docker", ["compose", "-f", LOCAL_HOSTED_COMPOSE_FILE, ...args], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: "inherit"
    });
  } catch (error) {
    if (!ignoreFailure) throw error;
  }
}

function dockerInspectHealth() {
  try {
    return execFileSync("docker", [
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      LOCAL_HOSTED_POSTGRES_CONTAINER
    ], { encoding: "utf8", windowsHide: true }).trim();
  } catch {
    return "missing";
  }
}

async function httpStatus(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return `HTTP ${response.status}`;
  } catch {
    return "UNREACHABLE";
  }
}

async function assertPortsFree(ports) {
  const occupied = [];
  for (const port of ports) {
    if (await isPortOpen(port)) occupied.push(port);
  }
  if (occupied.length) {
    throw new Error(
      `Porty ${occupied.join(", ")} už používá jiný proces. Zastav starý lokální API/worker/frontend a spusť příkaz znovu.`
    );
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

function assertLocalSecrets() {
  const required = [
    "EMPIRE_ADMIN_BOOTSTRAP_USERNAME",
    "EMPIRE_ADMIN_BOOTSTRAP_PASSWORD",
    "EMPIRE_ADMIN_FINGERPRINT_SECRET",
    "EMPIRE_ADMIN_SESSION_SECRET",
    "GAMEPLAY_SLICE_SESSION_SECRET",
    "GAMEPLAY_SLICE_SNAPSHOT_SECRET",
    "EMPIRE_AUTH_THROTTLE_PEPPER"
  ];
  const missing = required.filter((name) => !String(environment[name] ?? "").trim());
  if (missing.length) {
    throw new Error(`V .env.local chybí required proměnné: ${missing.join(", ")}.`);
  }
}

async function loadLocalEnvironment() {
  if (!existsSync(".env.local")) throw new Error(".env.local neexistuje.");
  if (!process.loadEnvFile) throw new Error("Aktuální Node neumí načíst .env.local.");
  process.loadEnvFile(".env.local");
}

async function readPidState() {
  try {
    return JSON.parse(await readFile(LOCAL_HOSTED_PID_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function isManagedRuntimeActive() {
  const state = await readPidState();
  return Boolean(state && ["supervisor", "api", "worker", "frontend"].some((name) =>
    isProcessAlive(state[name])
  ));
}

function isProcessAlive(pid) {
  if (!Number.isSafeInteger(Number(pid)) || Number(pid) <= 0) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function stopPid(pid) {
  if (!isProcessAlive(pid)) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore"
    });
  } else {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      return;
    }
  }
}

function git(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true
  }).trim();
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
