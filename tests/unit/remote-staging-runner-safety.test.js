import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  archiveRemoteStagingServerWithRetry,
  assertPinnedRemoteStagingFlyApp,
  isExactRemoteStagingWorkerHealth,
  isRetryableRemoteStagingArchiveError,
  REMOTE_STAGING_PLAYWRIGHT_TRACE_ARGUMENT
} from "../../scripts/remote-staging-runner-safety.mjs";

const source = (relativePath) => readFileSync(relativePath, "utf8");

describe("remote staging runner safety", () => {
  it("retries only bounded lifecycle archive conflicts", async () => {
    let currentTime = 0;
    let archived = false;
    let archiveAttempts = 0;
    await expect(archiveRemoteStagingServerWithRetry({
      loadServer: async () => ({ status: archived ? "archived" : "running", version: 1 }),
      requestArchive: async () => {
        archiveAttempts += 1;
        if (archiveAttempts === 1) throw new Error("SERVER_LIFECYCLE_OPERATION_ACTIVE");
        archived = true;
      },
      wait: async (milliseconds) => { currentTime += milliseconds; },
      now: () => currentTime,
      timeoutMs: 5_000,
      retryDelayMs: 1_000
    })).resolves.toBe("archived");
    expect(archiveAttempts).toBe(2);
    expect(isRetryableRemoteStagingArchiveError(new Error("ADMIN_STALE_VERSION"))).toBe(true);

    await expect(archiveRemoteStagingServerWithRetry({
      loadServer: async () => ({ status: "running", version: 1 }),
      requestArchive: async () => { throw new Error("UNEXPECTED_REMOTE_FAILURE"); },
      wait: async () => {},
      timeoutMs: 5_000
    })).rejects.toThrow(/UNEXPECTED_REMOTE_FAILURE/u);
  });

  it("fails a permanently active archive operation at the configured bound", async () => {
    let currentTime = 0;
    let archiveAttempts = 0;
    await expect(archiveRemoteStagingServerWithRetry({
      loadServer: async () => ({ status: "running", version: archiveAttempts + 1 }),
      requestArchive: async () => {
        archiveAttempts += 1;
        throw new Error("SERVER_LIFECYCLE_OPERATION_ACTIVE");
      },
      wait: async (milliseconds) => { currentTime += milliseconds; },
      now: () => currentTime,
      timeoutMs: 2_000,
      retryDelayMs: 1_000
    })).rejects.toThrow(/REMOTE_STAGING_ARCHIVE_TIMEOUT/u);
    expect(archiveAttempts).toBe(2);
  });

  it("allows restart health only for the exact pinned staging app and release", () => {
    expect(assertPinnedRemoteStagingFlyApp({
      app: "empire-staging-worker",
      pinnedApp: "empire-staging-worker"
    })).toBe("empire-staging-worker");
    expect(() => assertPinnedRemoteStagingFlyApp({
      app: "empire-staging-worker",
      pinnedApp: "another-staging-worker"
    })).toThrow(/NOT_PINNED/u);
    expect(() => assertPinnedRemoteStagingFlyApp({
      app: "empire-production-worker",
      pinnedApp: "empire-production-worker"
    })).toThrow(/PRODUCTION_LIKE/u);

    const sha = "a".repeat(40);
    expect(isExactRemoteStagingWorkerHealth({
      status: "ok",
      environment: "staging",
      buildSha: sha,
      heartbeat: { registered: true }
    }, sha)).toBe(true);
    expect(isExactRemoteStagingWorkerHealth({
      status: "ok",
      environment: "production",
      buildSha: sha,
      heartbeat: { registered: true }
    }, sha)).toBe(false);
    expect(isExactRemoteStagingWorkerHealth({
      status: "ok",
      environment: "staging",
      buildSha: "b".repeat(40),
      heartbeat: { registered: true }
    }, sha)).toBe(false);
  });

  it("keeps credential-bearing Playwright traces out of commands and uploads", () => {
    const suiteRunner = source("scripts/run-remote-staging-suite.mjs");
    const loadRunner = source("scripts/run-remote-staging-load-soak.mjs");
    const workflow = source(".github/workflows/staging-remote-acceptance.yml");
    const playwrightConfig = source("playwright.config.ts");

    expect(REMOTE_STAGING_PLAYWRIGHT_TRACE_ARGUMENT).toBe("--trace=off");
    expect(suiteRunner).not.toContain("--trace=on");
    expect(suiteRunner).not.toContain("--trace=retain-on-failure");
    expect(loadRunner).not.toContain("--trace=on");
    expect(loadRunner).not.toContain("--trace=retain-on-failure");
    expect(workflow).toContain("!artifacts/remote-staging/${{ matrix.suite }}/**/trace.zip");
    expect(workflow).toContain("!artifacts/remote-staging/load-soak/**/trace.zip");
    expect(playwrightConfig).toContain('screenshot: "only-on-failure"');
  });

  it("captures cleanup IDs immediately and pins restart before any Fly mutation", () => {
    const suiteRunner = source("scripts/run-remote-staging-suite.mjs");
    const loadRunner = source("scripts/run-remote-staging-load-soak.mjs");
    const workflow = source(".github/workflows/staging-remote-acceptance.yml");
    const restartSource = suiteRunner.slice(
      suiteRunner.indexOf("async function restartSingleStagingWorker"),
      suiteRunner.indexOf("async function performServerAction")
    );

    expect(suiteRunner).toContain("onCreated: ({ serverInstanceId }) => {");
    expect(suiteRunner).toContain("if (admin && cleanupServerInstanceId)");
    expect(loadRunner).toContain("onCreated: ({ serverInstanceId }) => {");
    expect(loadRunner).toContain("if (admin && cleanupServerInstanceId)");
    expect(workflow).toContain(
      "EMPIRE_PRE_ALPHA_STAGING_FLY_APP: ${{ vars.FLY_STAGING_APP }}"
    );
    expect(restartSource.indexOf("assertPinnedRemoteStagingFlyApp")).toBeGreaterThanOrEqual(0);
    expect(restartSource.indexOf("const preflightHealth = await readStagingWorkerHealth"))
      .toBeGreaterThan(restartSource.indexOf("assertPinnedRemoteStagingFlyApp"));
    expect(restartSource.indexOf('["machine", "restart"'))
      .toBeGreaterThan(restartSource.indexOf("const preflightHealth = await readStagingWorkerHealth"));
    expect(restartSource).toContain("isExactRemoteStagingWorkerHealth(payload, releaseSha)");
  });

  it("keeps the lifecycle nonce private and requires a positive invariant count", () => {
    const suiteRunner = source("scripts/run-remote-staging-suite.mjs");
    const lifecycleTool = source("tools/seed/hosted-staging-full-lifecycle-step.mjs");
    const workflow = source(".github/workflows/staging-remote-acceptance.yml");
    const emittedPayload = lifecycleTool.slice(
      lifecycleTool.indexOf("console.log(JSON.stringify({"),
      lifecycleTool.indexOf("}));", lifecycleTool.indexOf("console.log(JSON.stringify({"))
    );

    expect(suiteRunner).toContain("EMPIRE_REMOTE_STAGING_RUN_NONCE_HASH");
    expect(suiteRunner).toContain("EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_AFTER");
    expect(suiteRunner).toContain("EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_BEFORE");
    expect(suiteRunner).not.toMatch(/evidence\.(?:runNonce|fixtureBinding)/u);
    expect(emittedPayload).not.toContain("runNonceHash");
    expect(emittedPayload).not.toContain("expectedDisplayPrefix");
    expect(lifecycleTool).toContain("invariantChecks: invariantReport.checked");
    expect(suiteRunner).toContain("stable.invariantChecks <= 0");
    expect(workflow).toContain(".fullLifecycle.invariants.checks > 0");
  });
});
