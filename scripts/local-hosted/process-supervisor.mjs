import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RECENT_LINE_LIMIT = 80;
const COMMAND_STOP_GRACE_MS = 2_000;
const PROCESS_STOP_GRACE_MS = 10_000;
const PROCESS_FORCE_STOP_GRACE_MS = 1_000;
const PROCESS_STREAM_CLOSE_GRACE_MS = 250;
const managedProcessGroups = new WeakSet();
const activeManagedProcesses = new Set();
const TERMINATION_EXIT_CODES = Object.freeze({ SIGINT: 130, SIGTERM: 143 });
let terminationHandlersInstalled = false;
let terminationShutdownStarted = false;

export async function createRunDirectory(root = ".tmp/local-hosted-full") {
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/u, "Z");
  const directory = path.resolve(root, stamp);
  await mkdir(directory, { recursive: true });
  return directory;
}

export function startManagedProcess({ name, args, environment, logDirectory }) {
  installTerminationHandlers();
  const recentLines = [];
  const ownsProcessGroup = process.platform !== "win32";
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: ownsProcessGroup,
    windowsHide: true
  });
  if (ownsProcessGroup) managedProcessGroups.add(child);
  const chunks = [];
  const attach = (stream) => {
    let pending = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      chunks.push(chunk);
      pending += chunk;
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop() || "";
      for (const line of lines) rememberLine(recentLines, line);
    });
    stream.on("end", () => {
      if (pending) rememberLine(recentLines, pending);
    });
  };
  attach(child.stdout);
  attach(child.stderr);
  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
    child.once("error", (error) => resolve({ code: 1, signal: null, error }));
  });
  const closed = new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
    child.once("error", (error) => resolve({ code: 1, signal: null, error }));
  });
  const saveLog = async () => {
    await writeFile(path.join(logDirectory, `${name}.log`), chunks.join(""), "utf8");
  };
  const closeOutput = () => {
    child.stdout?.destroy();
    child.stderr?.destroy();
  };
  const managed = {
    child,
    closeOutput,
    closed,
    exited,
    name,
    recentLines,
    saveLog,
    stopPromise: null
  };
  activeManagedProcesses.add(managed);
  void closed.then(() => activeManagedProcesses.delete(managed));
  return managed;
}

export async function runManagedCommand({
  name,
  args,
  environment,
  logDirectory,
  timeoutMs = 300_000
}) {
  const managed = startManagedProcess({ name, args, environment, logDirectory });
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({ code: 124, signal: "timeout" }), timeoutMs);
    timeoutId.unref?.();
  });
  const result = await Promise.race([managed.exited, timeout]);
  clearTimeout(timeoutId);
  await stopManagedProcess(managed, { stopGraceMs: COMMAND_STOP_GRACE_MS });
  if (result.code !== 0) {
    const tail = managed.recentLines.join("\n");
    throw new Error(`${name} failed with exit ${result.code}.${tail ? `\n${tail}` : ""}`);
  }
  return result;
}

export async function waitForHttp(url, {
  timeoutMs = 120_000,
  processRef,
  acceptedStatuses = [200]
} = {}) {
  const startedAt = Date.now();
  let lastError = "no response";
  while (Date.now() - startedAt < timeoutMs) {
    if (processRef?.child.exitCode !== null) {
      throw new Error(`${processRef.name} exited before ${url} became ready.`);
    }
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (acceptedStatuses.includes(response.status)) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}.`);
}

export async function stopManagedProcesses(processes) {
  for (const managed of [...processes].reverse()) stopProcessTree(managed.child);
  await Promise.all(processes.map((managed) => stopManagedProcess(managed)));
}

export async function stopManagedProcess(managed, {
  stopGraceMs = PROCESS_STOP_GRACE_MS,
  forceStopGraceMs = PROCESS_FORCE_STOP_GRACE_MS
} = {}) {
  if (!managed?.child) return;
  if (managed.stopPromise) return managed.stopPromise;
  managed.stopPromise = (async () => {
    stopProcessTree(managed.child);
    if (!await waitForProcessTreeExit(managed.child, stopGraceMs)) {
      stopProcessTree(managed.child, { force: true });
      await waitForProcessTreeExit(managed.child, forceStopGraceMs);
    }
    await Promise.race([
      managed.closed || managed.exited,
      delay(PROCESS_STREAM_CLOSE_GRACE_MS)
    ]);
    managed.closeOutput?.();
    managed.child.unref?.();
    await managed.saveLog();
  })().finally(() => {
    activeManagedProcesses.delete(managed);
  });
  return managed.stopPromise;
}

export function stopProcessTree(child, { force = false } = {}) {
  if (!child?.pid) return false;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore"
    });
    return result.status === 0;
  }

  const signal = force ? "SIGKILL" : "SIGTERM";
  if (managedProcessGroups.has(child)) {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
  if (child.exitCode === null && child.signalCode === null) {
    return child.kill(signal);
  }
  return false;
}

export const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function rememberLine(lines, line) {
  const normalized = String(line || "").trim();
  if (!normalized) return;
  lines.push(normalized);
  if (lines.length > RECENT_LINE_LIMIT) lines.splice(0, lines.length - RECENT_LINE_LIMIT);
}

async function waitForProcessTreeExit(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (isProcessTreeRunning(child)) {
    if (Date.now() >= deadline) return false;
    await delay(25);
  }
  return true;
}

function isProcessTreeRunning(child) {
  if (!child?.pid) return false;
  if (process.platform !== "win32" && managedProcessGroups.has(child)) {
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      return error?.code !== "ESRCH";
    }
  }
  return child.exitCode === null && child.signalCode === null;
}

function installTerminationHandlers() {
  if (terminationHandlersInstalled) return;
  terminationHandlersInstalled = true;
  for (const signal of Object.keys(TERMINATION_EXIT_CODES)) {
    process.on(signal, () => beginTerminationShutdown(signal));
  }
  process.once("exit", forceStopActiveProcessTrees);
}

function beginTerminationShutdown(signal) {
  const exitCode = TERMINATION_EXIT_CODES[signal] ?? 1;
  if (terminationShutdownStarted) {
    forceStopActiveProcessTrees();
    process.exit(exitCode);
  }
  terminationShutdownStarted = true;
  void stopManagedProcesses([...activeManagedProcesses])
    .catch(() => {
      console.error("[process-supervisor] Managed process cleanup failed during termination.");
    })
    .finally(() => process.exit(exitCode));
}

function forceStopActiveProcessTrees() {
  for (const managed of activeManagedProcesses) {
    try {
      stopProcessTree(managed.child, { force: true });
      managed.closeOutput?.();
    } catch {
      // Process exit cleanup is best effort and must not expose child diagnostics.
    }
  }
}
