import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createLocalHostedAdminClient,
  provisionDisposableHostedServer,
  startDisposableHostedServer
} from "./local-hosted/admin-fixture-client.mjs";
import { delay } from "./local-hosted/process-supervisor.mjs";
import {
  getRemoteStagingAcceptanceSuite,
  REMOTE_MANUAL_STARTING_PLAYER_STATE
} from "./remote-staging-acceptance-suites.mjs";
import { isLifecycleRegistrationSnapshotReady } from "./remote-staging-full-lifecycle-contract.mjs";
import {
  archiveRemoteStagingServerWithRetry,
  assertPinnedRemoteStagingFlyApp,
  isExactRemoteStagingWorkerHealth,
  REMOTE_STAGING_PLAYWRIGHT_TRACE_ARGUMENT
} from "./remote-staging-runner-safety.mjs";
import { assertSupportedNodeVersion } from "./supported-node-policy.mjs";

assertSupportedNodeVersion(process.versions.node);
const suiteName = readArgument("--suite");
const suite = getRemoteStagingAcceptanceSuite(suiteName);
const root = process.cwd();
const releaseSha = exactSha(process.env.EMPIRE_BUILD_SHA, "REMOTE_STAGING_BUILD_SHA_INVALID");
const checkoutSha = exactSha(execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), "REMOTE_STAGING_HEAD_INVALID");
if (releaseSha !== checkoutSha) throw new Error("REMOTE_STAGING_BUILD_SHA_MISMATCH");
if (execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" }).trim()) {
  throw new Error("REMOTE_STAGING_WORKTREE_DIRTY");
}
const publicOrigin = exactStagingOrigin(process.env.EMPIRE_PUBLIC_ORIGIN);
if (process.env.NODE_ENV !== "production" || process.env.EMPIRE_RELEASE_ENVIRONMENT !== "staging") {
  throw new Error("REMOTE_STAGING_ENVIRONMENT_INVALID");
}
const adminUsername = required(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME, "REMOTE_STAGING_ADMIN_USERNAME_REQUIRED");
const adminPassword = required(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD, "REMOTE_STAGING_ADMIN_PASSWORD_REQUIRED");
const artifactDirectory = path.resolve(
  String(process.env.EMPIRE_REMOTE_STAGING_ARTIFACT_ROOT || `artifacts/remote-staging/${suite.name}`)
);
mkdirSync(artifactDirectory, { recursive: true });

const startedAt = Date.now();
const evidence = {
  buildSha: releaseSha,
  environment: "staging",
  publicOrigin,
  suite: suite.name,
  status: "running",
  serverInstanceHash: null,
  scenario: suite.scenario || null,
  workerRestart: suite.restartWorkerBeforeSpec ? "pending" : "not-requested",
  pauseResume: suite.pauseResumeBeforeSpec ? "pending" : "not-requested",
  fullLifecycle: suite.fullLifecycle ? { status: "pending" } : null,
  cleanup: "not-started",
  bootstrap: null,
  playwrightRuns: []
};

let admin = null;
let server = null;
let cleanupServerInstanceId = null;
let fixtureBinding = null;
try {
  if (suite.manual) {
    await runPlaywrightSuite(suite.playwrightRuns, {
      ...publicBrowserEnvironment(),
      EMPIRE_MANUAL_HOSTED_E2E: "1",
      EMPIRE_ADMIN_HOSTED_LIVE_E2E: "1",
      EMPIRE_ADMIN_BOOTSTRAP_USERNAME: adminUsername,
      EMPIRE_ADMIN_BOOTSTRAP_PASSWORD: adminPassword,
      EMPIRE_MANUAL_HOSTED_DISPLAY_NAME: `Remote Staging Acceptance Manual ${randomBytes(4).toString("hex")}`,
      EMPIRE_MANUAL_HOSTED_STARTING_STATE_JSON: JSON.stringify(REMOTE_MANUAL_STARTING_PLAYER_STATE)
    });
    evidence.cleanup = "archived-by-visible-admin-flow";
  } else {
    admin = await createLocalHostedAdminClient({
      apiOrigin: publicOrigin,
      browserOrigin: publicOrigin,
      username: adminUsername,
      password: adminPassword
    });
    const identities = createIdentities(suite.name, suite.bootstrapCount);
    const runNonceHash = createHash("sha256").update(randomBytes(32)).digest("hex");
    const displayNamePrefix = `Remote Staging Acceptance ${suite.name} ${runNonceHash.slice(0, 16)}`;
    const provisionStartedAt = Date.now();
    server = await provisionDisposableHostedServer(admin, {
      displayNamePrefix,
      capacity: suite.capacity,
      startingPlayerState: suite.startingPlayerState,
      onCreated: ({ serverInstanceId }) => {
        cleanupServerInstanceId = serverInstanceId;
        evidence.serverInstanceHash = safeHash(serverInstanceId);
        fixtureBinding = Object.freeze({
          expectedDisplayPrefix: displayNamePrefix,
          runNonceHash,
          createdAfter: new Date(provisionStartedAt - 60_000).toISOString(),
          createdBefore: new Date(Date.now() + 60_000).toISOString()
        });
      }
    });
    cleanupServerInstanceId ??= server.serverInstanceId;
    evidence.serverInstanceHash ??= safeHash(server.serverInstanceId);
    await runPlaywright("bootstrap", ["tests/e2e/local-hosted-bootstrap-player.spec.js"], {
      ...publicBrowserEnvironment(),
      EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON: JSON.stringify(identities),
      EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON: JSON.stringify(suite.startingPlayerState),
      EMPIRE_UI_PARITY_SERVER_ID: server.serverInstanceId
    }, suite.bootstrapTimeoutMs);
    evidence.bootstrap = await verifyBootstrappedMemberships(admin, server.serverInstanceId, {
      expectedCapacity: suite.capacity,
      expectedPlayers: suite.bootstrapCount
    });
    if (suite.scenario) runStagingScenario(server.serverInstanceId, suite.scenario);
    await startDisposableHostedServer(admin, server.serverInstanceId);
    if (suite.pauseResumeBeforeSpec) {
      await performServerAction(admin, server.serverInstanceId, "pause");
      await waitForServerStatus(admin, server.serverInstanceId, "paused");
      await performServerAction(admin, server.serverInstanceId, "resume");
      await waitForServerStatus(admin, server.serverInstanceId, "running");
      evidence.pauseResume = "passed";
    }
    if (suite.restartWorkerBeforeSpec) {
      await restartSingleStagingWorker();
      evidence.workerRestart = "passed";
    }
    const identityEnvironment = {
      EMPIRE_HOSTED_BOOTSTRAP_USERNAME: identities[0].username,
      EMPIRE_HOSTED_BOOTSTRAP_GANG_NAME: identities[0].gangName,
      EMPIRE_HOSTED_BOOTSTRAP_PASSWORD: identities[0].password,
      EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER: identities[0].networkIdentifier,
      EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON: JSON.stringify(identities),
      EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON: JSON.stringify(suite.startingPlayerState)
    };
    const suiteBrowserEnvironment = {
      ...publicBrowserEnvironment(),
      ...identityEnvironment,
      EMPIRE_UI_PARITY_SERVER_ID: server.serverInstanceId,
      EMPIRE_CAPTURE_UI_PARITY_BASELINE: "1",
      EMPIRE_UI_PARITY_ARTIFACT_ROOT: path.join(artifactDirectory, "ui-parity"),
      ...(suite.name === "lifecycle-stop" ? {
        EMPIRE_ADMIN_HOSTED_LIVE_E2E: "1",
        EMPIRE_ADMIN_BOOTSTRAP_USERNAME: adminUsername,
        EMPIRE_ADMIN_BOOTSTRAP_PASSWORD: adminPassword
      } : {})
    };
    if (suite.fullLifecycle) {
      await runPlaywrightSuite(suite.preLifecyclePlaywrightRuns, suiteBrowserEnvironment);
      evidence.fullLifecycle = await runFullLifecycle(admin, server.serverInstanceId);
      writeFileSync(
        path.join(artifactDirectory, "lifecycle-report.json"),
        `${JSON.stringify(evidence.fullLifecycle, null, 2)}\n`,
        "utf8"
      );
      writeFileSync(
        path.join(artifactDirectory, "invariant-report.json"),
        `${JSON.stringify(evidence.fullLifecycle.invariants, null, 2)}\n`,
        "utf8"
      );
    }
    await runPlaywrightSuite(suite.playwrightRuns, suiteBrowserEnvironment);
  }
  evidence.status = "passed";
} catch (error) {
  evidence.status = "failed";
  evidence.errorCode = safeErrorCode(error);
  throw error;
} finally {
  if (admin && cleanupServerInstanceId) {
    try {
      await archiveServer(admin, cleanupServerInstanceId);
      evidence.cleanup = "archived";
    } catch (cleanupError) {
      evidence.cleanup = "failed";
      evidence.cleanupErrorCode = safeErrorCode(cleanupError);
      if (evidence.status === "passed") {
        evidence.status = "failed";
        process.exitCode = 1;
      }
    }
  }
  writeFileSync(path.join(artifactDirectory, "cleanup-report.json"), `${JSON.stringify({
    status: evidence.cleanup === "archived" || evidence.cleanup === "archived-by-visible-admin-flow"
      ? "passed" : "failed",
    cleanup: evidence.cleanup,
    serverInstanceHash: evidence.serverInstanceHash,
    errorCode: evidence.cleanupErrorCode ?? null
  }, null, 2)}\n`, "utf8");
  evidence.durationMs = Date.now() - startedAt;
  writeFileSync(path.join(artifactDirectory, "summary.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

async function runPlaywrightSuite(runs, baseEnvironment) {
  for (const playwrightRun of runs) {
    await runPlaywright(
      playwrightRun.name,
      playwrightRun.specs,
      { ...baseEnvironment, ...playwrightRun.environment },
      playwrightRun.timeoutMs,
      playwrightRun.grep
    );
  }
}

async function runPlaywright(name, specs, environment, timeoutMs, grep = "") {
  const outputDirectory = path.join(artifactDirectory, "playwright", name);
  const summaryPath = path.join(artifactDirectory, `${name}-release-summary.json`);
  mkdirSync(outputDirectory, { recursive: true });
  const args = [
    "scripts/run-local-bin.mjs",
    "playwright/cli.js",
    "test",
    "--project=chromium",
    "--workers=1",
    REMOTE_STAGING_PLAYWRIGHT_TRACE_ARGUMENT,
    "--forbid-only",
    "--fail-on-flaky-tests",
    "--retries=0",
    `--output=${outputDirectory}`,
    "--reporter=./scripts/playwright-release-reporter.mjs",
    ...(grep ? [`--grep=${grep}`] : []),
    ...specs
  ];
  runProcess(process.execPath, args, {
    environment: {
      ...sanitizedChildEnvironment(),
      ...environment,
      EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY: summaryPath
    },
    timeoutMs
  });
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  if (summary.status !== "passed"
    || summary.counts?.skipped !== 0
    || summary.counts?.notRun !== 0
    || summary.counts?.retries !== 0) {
    throw new Error(`REMOTE_STAGING_PLAYWRIGHT_NOT_PASSED:${name}`);
  }
  evidence.playwrightRuns.push({
    name,
    summaryPath: path.relative(root, summaryPath).replace(/\\/gu, "/"),
    ...summary
  });
}

async function runFullLifecycle(adminClient, serverInstanceId) {
  const report = {
    status: "running",
    playerCount: 20,
    registration: null,
    statusTransitions: ["running"],
    eliminationTransitions: [],
    quietHourDeferrals: 0,
    workerRecovery: "pending",
    finalLockdown: null,
    result: null,
    invariants: null
  };

  await performServerAction(adminClient, serverInstanceId, "close-registration-now");
  const closed = await waitForServer(adminClient, serverInstanceId, (candidate) => (
    candidate.status === "running"
    && candidate.joinPolicy === "closed"
    && candidate.registrationClosedAt !== null
    && candidate.registrationBaselinePlayers === 20
    && candidate.effectiveFinalLockdownTrigger === 8
  ));
  report.registration = {
    state: closed.registrationState,
    closed: true,
    baselinePlayers: closed.registrationBaselinePlayers,
    effectiveFinalLockdownTrigger: closed.effectiveFinalLockdownTrigger,
    effectiveFirstEliminationTick: closed.effectiveFirstEliminationTick
  };

  let inspection = await waitForLifecycleInspection(serverInstanceId, (candidate) => (
    isLifecycleRegistrationSnapshotReady(candidate, {
      baselinePlayers: closed.registrationBaselinePlayers,
      effectiveFinalLockdownTrigger: closed.effectiveFinalLockdownTrigger,
      effectiveFirstEliminationTick: closed.effectiveFirstEliminationTick
    })
  ));
  if (inspection.activePlayers !== 20 || inspection.eliminatedPlayers !== 0
    || inspection.membershipCount !== 20 || inspection.invariantViolationCodes.length > 0) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_INITIAL_INVARIANT_FAILED");
  }

  let attempts = 0;
  let workerRestarted = false;
  let paused = false;
  while (inspection.eliminationCount < 12 && attempts < 30) {
    attempts += 1;
    if (!paused) {
      await performServerAction(adminClient, serverInstanceId, "pause");
      await waitForServerStatus(adminClient, serverInstanceId, "paused");
      report.statusTransitions.push("paused");
      paused = true;
    }
    inspection = runStagingLifecycleStep(serverInstanceId, "inspect");
    const before = inspection;
    const prepared = runStagingLifecycleStep(serverInstanceId, "prepare-next-elimination");

    if (!workerRestarted && before.eliminationCount === 6) {
      await restartSingleStagingWorker();
      workerRestarted = true;
      report.workerRecovery = "passed";
    }

    await performServerAction(adminClient, serverInstanceId, "resume");
    await waitForServerStatus(adminClient, serverInstanceId, "running");
    report.statusTransitions.push("running");
    paused = false;
    const progressed = await waitForLifecycleInspection(serverInstanceId, (candidate) => (
      candidate.tick > prepared.tick
      || candidate.eliminationCount > before.eliminationCount
      || candidate.matchResultHash !== null
    ));

    if (!progressed.matchResultHash) {
      await performServerAction(adminClient, serverInstanceId, "pause");
      await waitForServerStatus(adminClient, serverInstanceId, "paused");
      report.statusTransitions.push("paused");
      paused = true;
    }
    inspection = runStagingLifecycleStep(serverInstanceId, "inspect");
    if (inspection.invariantViolationCodes.length > 0) {
      throw new Error("REMOTE_STAGING_LIFECYCLE_INVARIANT_FAILED");
    }
    if (inspection.eliminationCount > before.eliminationCount) {
      if (inspection.eliminationCount !== before.eliminationCount + 1
        || inspection.activePlayers !== before.activePlayers - 1
        || inspection.eliminatedPlayers !== inspection.eliminationCount) {
        throw new Error("REMOTE_STAGING_LIFECYCLE_ELIMINATION_NOT_EXACTLY_ONCE");
      }
      report.eliminationTransitions.push({
        eliminationCount: inspection.eliminationCount,
        activePlayers: inspection.activePlayers,
        tick: inspection.tick,
        rootVersion: inspection.rootVersion
      });
    } else {
      report.quietHourDeferrals += 1;
    }
  }

  if (inspection.eliminationCount !== 12 || inspection.activePlayers !== 8
    || !["active", "paused"].includes(inspection.finalLockdownStatus)) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_FINAL_LOCKDOWN_NOT_REACHED");
  }
  if (!workerRestarted) throw new Error("REMOTE_STAGING_LIFECYCLE_WORKER_RESTART_NOT_RUN");

  const lockdownPrepared = runStagingLifecycleStep(
    serverInstanceId,
    "prepare-final-lockdown-resolution"
  );
  report.finalLockdown = {
    status: "started",
    activePlayers: inspection.activePlayers,
    startedAtTick: inspection.tick,
    remainingActiveTicks: inspection.finalLockdownRemainingTicks,
    preparedResolutionTick: lockdownPrepared.tick
  };
  await performServerAction(adminClient, serverInstanceId, "resume");
  await waitForServerStatus(adminClient, serverInstanceId, "running");
  report.statusTransitions.push("running");

  const resolved = await waitForLifecycleInspection(serverInstanceId, (candidate) => (
    candidate.matchResultHash !== null
    && candidate.resultPayloadMatchesSnapshot === true
    && candidate.rankingPayloadMatchesSnapshot === true
    && candidate.membershipRankingMatchesSnapshot === true
    && candidate.finalLockdownStatus === "resolved"
    && candidate.persistedMatchResultCount === 1
    && candidate.defeatedMembershipCount === 0
    && candidate.completedMembershipCount === 20
    && candidate.rankedMembershipCount === 20
  ), 180_000);
  await waitForServerStatus(adminClient, serverInstanceId, "stopped", 180_000);
  report.statusTransitions.push("stopped");
  const stable = runStagingLifecycleStep(serverInstanceId, "inspect");
  if (stable.matchResultHash !== resolved.matchResultHash
    || stable.snapshotMatchResultHash !== stable.persistedMatchResultHash
    || stable.resultPayloadMatchesSnapshot !== true
    || stable.snapshotRankingHash !== stable.persistedRankingHash
    || stable.snapshotRankingHash !== stable.membershipRankingHash
    || stable.rankingPayloadMatchesSnapshot !== true
    || stable.membershipRankingMatchesSnapshot !== true
    || stable.activePlayers !== 8
    || stable.eliminatedPlayers !== 12
    || stable.eliminationCount !== 12
    || stable.persistedMatchResultCount !== 1
    || stable.membershipCount !== 20
    || stable.rankedMembershipCount !== 20
    || stable.defeatedMembershipCount !== 0
    || stable.completedMembershipCount !== 20
    || !Number.isInteger(stable.invariantChecks)
    || stable.invariantChecks <= 0
    || stable.invariantViolationCodes.length > 0) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_RESULT_NOT_STABLE");
  }

  report.finalLockdown = {
    ...report.finalLockdown,
    status: "resolved",
    resolvedAtTick: stable.tick
  };
  report.result = {
    matchResultHash: stable.matchResultHash,
    snapshotMatchResultHash: stable.snapshotMatchResultHash,
    persistedMatchResultHash: stable.persistedMatchResultHash,
    resultPayloadMatchesSnapshot: stable.resultPayloadMatchesSnapshot,
    snapshotRankingHash: stable.snapshotRankingHash,
    persistedRankingHash: stable.persistedRankingHash,
    membershipRankingHash: stable.membershipRankingHash,
    rankingPayloadMatchesSnapshot: stable.rankingPayloadMatchesSnapshot,
    membershipRankingMatchesSnapshot: stable.membershipRankingMatchesSnapshot,
    winnerHash: stable.winnerHash,
    activePlayers: stable.activePlayers,
    eliminatedPlayers: stable.eliminatedPlayers,
    eliminationCount: stable.eliminationCount,
    persistedMatchResultCount: stable.persistedMatchResultCount,
    rankedMembershipCount: stable.rankedMembershipCount,
    defeatedMembershipCount: stable.defeatedMembershipCount,
    completedMembershipCount: stable.completedMembershipCount
  };
  report.invariants = {
    status: "passed",
    checks: stable.invariantChecks,
    violationCodes: stable.invariantViolationCodes
  };
  report.status = "passed";
  return report;
}

async function waitForLifecycleInspection(serverInstanceId, predicate, timeoutMs = 90_000) {
  const started = Date.now();
  let latest = null;
  while (Date.now() - started < timeoutMs) {
    latest = runStagingLifecycleStep(serverInstanceId, "inspect");
    if (predicate(latest)) return latest;
    await delay(1_000);
  }
  throw new Error(`REMOTE_STAGING_LIFECYCLE_INSPECTION_TIMEOUT:${latest?.tick ?? "none"}`);
}

function runStagingLifecycleStep(serverInstanceId, operation) {
  const result = runProcess(process.execPath, [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    "tools/seed/hosted-staging-full-lifecycle-step.mjs",
    `--server=${serverInstanceId}`,
    `--operation=${operation}`
  ], {
    capture: true,
    environment: stagingFixtureEnvironment(),
    timeoutMs: 180_000
  });
  const line = String(result.stdout ?? "").trim().split(/\r?\n/u)
    .reverse().find((candidate) => candidate.trim().startsWith("{"));
  if (!line) throw new Error("REMOTE_STAGING_LIFECYCLE_EVIDENCE_MISSING");
  try {
    return JSON.parse(line);
  } catch {
    throw new Error("REMOTE_STAGING_LIFECYCLE_EVIDENCE_INVALID");
  }
}

function runStagingScenario(serverInstanceId, scenario) {
  runProcess(process.execPath, [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    "tools/seed/hosted-staging-acceptance-scenario.mjs",
    `--server=${serverInstanceId}`,
    `--scenario=${scenario}`
  ], {
    environment: stagingFixtureEnvironment(),
    timeoutMs: 180_000
  });
}

function stagingFixtureEnvironment() {
  if (!fixtureBinding) throw new Error("REMOTE_STAGING_LIFECYCLE_BINDING_MISSING");
  return {
    ...sanitizedChildEnvironment(),
    NODE_ENV: "production",
    EMPIRE_RELEASE_ENVIRONMENT: "staging",
    EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
    EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED: "staging-only-fixture-write",
    EMPIRE_STAGING_DATABASE_TARGET_HASH: required(
      process.env.EMPIRE_STAGING_DATABASE_TARGET_HASH,
      "REMOTE_STAGING_DATABASE_TARGET_HASH_REQUIRED"
    ),
    EMPIRE_REMOTE_STAGING_FIXTURE_DISPLAY_PREFIX: fixtureBinding.expectedDisplayPrefix,
    EMPIRE_REMOTE_STAGING_RUN_NONCE_HASH: fixtureBinding.runNonceHash,
    EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_AFTER: fixtureBinding.createdAfter,
    EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_BEFORE: fixtureBinding.createdBefore,
    EMPIRE_DATABASE_URL: required(process.env.EMPIRE_DATABASE_URL, "REMOTE_STAGING_DATABASE_URL_REQUIRED"),
    GAMEPLAY_DATABASE_URL: required(process.env.GAMEPLAY_DATABASE_URL, "REMOTE_STAGING_GAMEPLAY_DATABASE_URL_REQUIRED")
  };
}

async function restartSingleStagingWorker() {
  const app = assertPinnedRemoteStagingFlyApp({
    app: required(process.env.FLY_STAGING_APP, "REMOTE_STAGING_FLY_APP_REQUIRED"),
    pinnedApp: required(
      process.env.EMPIRE_PRE_ALPHA_STAGING_FLY_APP,
      "REMOTE_STAGING_FLY_APP_PIN_REQUIRED"
    )
  });
  required(process.env.FLY_API_TOKEN, "REMOTE_STAGING_FLY_TOKEN_REQUIRED");
  const healthUrl = `https://${app}.fly.dev/health`;
  const preflightHealth = await readStagingWorkerHealth(healthUrl);
  if (!isExactRemoteStagingWorkerHealth(preflightHealth, releaseSha)) {
    throw new Error("REMOTE_STAGING_WORKER_PREFLIGHT_INVALID");
  }
  const listed = runProcess("flyctl", ["machines", "list", "--app", app, "--json"], {
    capture: true,
    environment: sanitizedChildEnvironment({ keepFlyToken: true }),
    timeoutMs: 60_000
  });
  const machines = JSON.parse(listed.stdout || "[]").filter((machine) => !["destroyed", "destroying"].includes(machine.state));
  if (machines.length !== 1 || !machines[0]?.id) throw new Error("REMOTE_STAGING_WORKER_REPLICA_COUNT_INVALID");
  runProcess("flyctl", ["machine", "restart", machines[0].id, "--app", app], {
    environment: sanitizedChildEnvironment({ keepFlyToken: true }),
    timeoutMs: 180_000
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const payload = await readStagingWorkerHealth(healthUrl);
    if (isExactRemoteStagingWorkerHealth(payload, releaseSha)) return;
    await delay(5_000);
  }
  throw new Error("REMOTE_STAGING_WORKER_RESTART_HEALTH_TIMEOUT");
}

async function performServerAction(adminClient, serverInstanceId, action) {
  const controlPlane = await adminClient.request("/api/admin/control-plane");
  const current = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
  if (!current) throw new Error("REMOTE_STAGING_SERVER_MISSING");
  await requestServerAction(adminClient, serverInstanceId, action, current.version);
}

async function requestServerAction(adminClient, serverInstanceId, action, expectedVersion) {
  await adminClient.request(`/api/admin/servers/${encodeURIComponent(serverInstanceId)}/actions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `remote-staging-${action}-${randomUUID()}`
    },
    body: JSON.stringify({
      action,
      expectedVersion,
      reason: `Remote staging acceptance ${action}`,
      ...(action === "close-registration-now" ? { confirmationToken: "CLOSE_REGISTRATION" } : {}),
      ...(action === "delete" ? { confirmationToken: "DELETE_SERVER" } : {})
    })
  });
}

async function waitForServerStatus(adminClient, serverInstanceId, status, timeoutMs = 180_000) {
  return waitForServer(
    adminClient,
    serverInstanceId,
    (serverRecord) => serverRecord.status === status,
    timeoutMs,
    `REMOTE_STAGING_SERVER_STATUS_TIMEOUT:${status}`
  );
}

async function waitForServer(
  adminClient,
  serverInstanceId,
  predicate,
  timeoutMs = 180_000,
  timeoutCode = "REMOTE_STAGING_SERVER_PREDICATE_TIMEOUT"
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const controlPlane = await adminClient.request("/api/admin/control-plane");
    const serverRecord = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
    if (serverRecord && predicate(serverRecord, controlPlane)) return serverRecord;
    await delay(1_000);
  }
  throw new Error(timeoutCode);
}

async function verifyBootstrappedMemberships(adminClient, serverInstanceId, {
  expectedCapacity,
  expectedPlayers
}, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const controlPlane = await adminClient.request("/api/admin/control-plane");
    const serverRecord = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
    if (!serverRecord) throw new Error("REMOTE_STAGING_BOOTSTRAP_SERVER_MISSING");
    if (serverRecord.capacity !== expectedCapacity) {
      throw new Error("REMOTE_STAGING_BOOTSTRAP_CAPACITY_MISMATCH");
    }
    if (serverRecord.committedPlayers === expectedPlayers && serverRecord.readyPlayers === expectedPlayers) {
      return {
        capacity: serverRecord.capacity,
        committedPlayers: serverRecord.committedPlayers,
        readyPlayers: serverRecord.readyPlayers,
        verified: true
      };
    }
    if (Number(serverRecord.committedPlayers ?? 0) > expectedPlayers
      || Number(serverRecord.readyPlayers ?? 0) > expectedPlayers) {
      throw new Error("REMOTE_STAGING_BOOTSTRAP_PLAYER_COUNT_EXCEEDED");
    }
    await delay(1_000);
  }
  throw new Error("REMOTE_STAGING_BOOTSTRAP_PLAYER_COUNT_TIMEOUT");
}

async function archiveServer(adminClient, serverInstanceId) {
  await archiveRemoteStagingServerWithRetry({
    loadServer: async () => {
      const controlPlane = await adminClient.request("/api/admin/control-plane");
      return controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId) ?? null;
    },
    requestArchive: (current) => requestServerAction(
      adminClient,
      serverInstanceId,
      "delete",
      current.version
    ),
    wait: delay
  });
}

async function readStagingWorkerHealth(healthUrl) {
  try {
    const response = await fetch(healthUrl, {
      cache: "no-store",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(5_000)
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function publicBrowserEnvironment() {
  return {
    NODE_ENV: "production",
    EMPIRE_RELEASE_ENVIRONMENT: "staging",
    EMPIRE_PUBLIC_ORIGIN: publicOrigin,
    PLAYWRIGHT_E2E_BASE_URL: publicOrigin,
    PLAYWRIGHT_E2E_HEALTH_URL: `${publicOrigin}/api/servers`,
    PLAYWRIGHT_SKIP_WEB_SERVER: "1",
    EMPIRE_HOSTED_UI_PARITY_E2E: "1"
  };
}

function createIdentities(name, count) {
  return Array.from({ length: count }, (_, index) => {
    const suffix = randomBytes(6).toString("hex");
    const prefix = `Remote${name.replace(/[^a-z0-9]/giu, "").slice(0, 8)}${index + 1}`;
    return {
      username: `${prefix}${suffix}`.slice(0, 32),
      gangName: `${prefix} Crew ${suffix}`.slice(0, 48),
      password: randomBytes(24).toString("base64url"),
      networkIdentifier: `2001:db8::${randomBytes(8).toString("hex")}`
    };
  });
}

function runProcess(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: options.environment,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    timeout: options.timeoutMs,
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    throw new Error(`REMOTE_STAGING_COMMAND_FAILED:${path.basename(command)}:${result.status ?? "spawn"}`);
  }
  return result;
}

function sanitizedChildEnvironment(options = {}) {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/(?:SECRET|PASSWORD|TOKEN|PEPPER|DATABASE_URL)/u.test(name)) delete environment[name];
  }
  if (options.keepFlyToken) environment.FLY_API_TOKEN = process.env.FLY_API_TOKEN;
  return environment;
}

function exactStagingOrigin(value) {
  if (value !== "https://staging.empirestreets.cz") throw new Error("REMOTE_STAGING_ORIGIN_INVALID");
  return value;
}
function exactSha(value, code) {
  const normalized = String(value ?? "").trim();
  if (!/^[0-9a-f]{40}$/u.test(normalized)) throw new Error(code);
  return normalized;
}
function required(value, code) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function safeHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}
function safeErrorCode(error) {
  return String(error?.message ?? error ?? "REMOTE_STAGING_UNKNOWN_ERROR").split(":", 1)[0].replace(/[^A-Z0-9_.-]/giu, "_").slice(0, 120);
}
function readArgument(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
}
