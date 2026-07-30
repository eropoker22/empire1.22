import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RECENT_LINE_LIMIT = 80;

export async function createRunDirectory(root = ".tmp/local-hosted-full") {
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/u, "Z");
  const directory = path.resolve(root, stamp);
  await mkdir(directory, { recursive: true });
  return directory;
}

export function startManagedProcess({ name, args, environment, logDirectory }) {
  const recentLines = [];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
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
  const saveLog = async () => {
    await writeFile(path.join(logDirectory, `${name}.log`), chunks.join(""), "utf8");
  };
  return { child, exited, name, recentLines, saveLog };
}

export async function runManagedCommand({
  name,
  args,
  environment,
  logDirectory,
  timeoutMs = 300_000
}) {
  const managed = startManagedProcess({ name, args, environment, logDirectory });
  const timeout = new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ code: 124, signal: "timeout" }), timeoutMs);
    timer.unref?.();
  });
  const result = await Promise.race([managed.exited, timeout]);
  if (result.signal === "timeout") stopProcessTree(managed.child);
  await managed.saveLog();
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
  await Promise.all(processes.map(async (managed) => {
    await Promise.race([managed.exited, delay(10_000)]);
    await managed.saveLog();
  }));
}

export function stopProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

export const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function rememberLine(lines, line) {
  const normalized = String(line || "").trim();
  if (!normalized) return;
  lines.push(normalized);
  if (lines.length > RECENT_LINE_LIMIT) lines.splice(0, lines.length - RECENT_LINE_LIMIT);
}
