import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runManagedCommand } from "../../scripts/local-hosted/process-supervisor.mjs";

const cleanupDirectories = [];
const cleanupPids = [];

afterEach(async () => {
  for (const pid of cleanupPids.splice(0)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  }
  await Promise.all(
    cleanupDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("local hosted process supervisor", () => {
  it("reaps descendants and inherited output pipes after an immediate command failure", async () => {
    const logDirectory = await mkdtemp(path.join(tmpdir(), "empire-process-supervisor-"));
    cleanupDirectories.push(logDirectory);
    const descendantPidPath = path.join(logDirectory, "descendant.pid");
    const supportsProcessGroupReaping = process.platform !== "win32";
    const descendantSource = [
      'process.stdout.on("error", () => process.exit(0));',
      'const heartbeat = setInterval(() => process.stdout.write("descendant-alive\\n"), 25);',
      "setTimeout(() => { clearInterval(heartbeat); process.exit(0); }, 10_000);"
    ].join("\n");
    const commandSource = [
      ...(supportsProcessGroupReaping ? [
        'import { spawn } from "node:child_process";',
        'import { writeFileSync } from "node:fs";',
        `const descendant = spawn(process.execPath, ["--input-type=module", "--eval", ${JSON.stringify(descendantSource)}], {`,
        '  stdio: ["ignore", "inherit", "inherit"]',
        "});",
        `writeFileSync(${JSON.stringify(descendantPidPath)}, String(descendant.pid), "utf8");`,
        "descendant.unref();"
      ] : []),
      'console.error("immediate-command-failure");',
      "process.exitCode = 23;"
    ].join("\n");

    await expect(runManagedCommand({
      name: "immediate-failure",
      args: ["--input-type=module", "--eval", commandSource],
      environment: { ...process.env },
      logDirectory,
      timeoutMs: 5_000
    })).rejects.toThrow(/immediate-failure failed with exit 23/u);

    if (supportsProcessGroupReaping) {
      const descendantPid = Number(await readFile(descendantPidPath, "utf8"));
      cleanupPids.push(descendantPid);
      await expect(waitForProcessExit(descendantPid)).resolves.toBe(true);
      cleanupPids.splice(cleanupPids.indexOf(descendantPid), 1);
    }
    await expect(readFile(path.join(logDirectory, "immediate-failure.log"), "utf8"))
      .resolves.toContain("immediate-command-failure");
  });

  it("reaps active POSIX process groups when the supervisor receives SIGTERM", async () => {
    if (process.platform === "win32") {
      expect(process.platform).toBe("win32");
      return;
    }
    const logDirectory = await mkdtemp(path.join(tmpdir(), "empire-process-supervisor-signal-"));
    cleanupDirectories.push(logDirectory);
    const childPidPath = path.join(logDirectory, "managed-child.pid");
    const supervisorUrl = pathToFileURL(
      path.resolve("scripts/local-hosted/process-supervisor.mjs")
    ).href;
    const parentSource = [
      `import { startManagedProcess } from ${JSON.stringify(supervisorUrl)};`,
      'import { writeFileSync } from "node:fs";',
      "const managed = startManagedProcess({",
      '  name: "signal-child",',
      '  args: ["--input-type=module", "--eval", "setInterval(() => {}, 1000)"],',
      "  environment: { ...process.env },",
      `  logDirectory: ${JSON.stringify(logDirectory)}`,
      "});",
      `writeFileSync(${JSON.stringify(childPidPath)}, String(managed.child.pid), "utf8");`,
      "setInterval(() => {}, 1_000);"
    ].join("\n");
    const parent = spawn(process.execPath, ["--input-type=module", "--eval", parentSource], {
      stdio: "ignore",
      windowsHide: true
    });
    cleanupPids.push(parent.pid);
    const parentExited = new Promise((resolve) => {
      parent.once("exit", (code, signal) => resolve({ code, signal }));
      parent.once("error", (error) => resolve({ code: 1, signal: null, error }));
    });
    await expect(waitForFile(childPidPath)).resolves.toBe(true);
    const childPid = Number(await readFile(childPidPath, "utf8"));
    cleanupPids.push(childPid);

    process.kill(parent.pid, "SIGTERM");
    await expect(Promise.race([
      parentExited,
      rejectAfter(5_000, "Supervisor did not exit after SIGTERM.")
    ])).resolves.toMatchObject({ code: 143, signal: null });
    removeCleanupPid(parent.pid);
    await expect(waitForProcessExit(childPid, 5_000)).resolves.toBe(true);
    removeCleanupPid(childPid);
  });
});

async function waitForProcessExit(pid, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !isProcessRunning(pid);
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

async function waitForFile(filePath, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await readFile(filePath, "utf8");
      return true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

const rejectAfter = (milliseconds, message) => new Promise((_, reject) => {
  const timeout = setTimeout(() => reject(new Error(message)), milliseconds);
  timeout.unref?.();
});

function removeCleanupPid(pid) {
  const index = cleanupPids.indexOf(pid);
  if (index >= 0) cleanupPids.splice(index, 1);
}
