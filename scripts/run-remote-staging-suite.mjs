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
  cleanup: "not-started",
  bootstrap: null,
  playwrightRuns: []
};

let admin = null;
let server = null;
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
    server = await provisionDisposableHostedServer(admin, {
      displayNamePrefix: `Remote Staging Acceptance ${suite.name}`,
      capacity: suite.capacity,
      startingPlayerState: suite.startingPlayerState
    });
    evidence.serverInstanceHash = safeHash(server.serverInstanceId);
    await runPlaywright("bootstrap", ["tests/e2e/local-hosted-bootstrap-player.spec.js"], {
      ...publicBrowserEnvironment(),
      EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON: JSON.stringify(identities),
      EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON: JSON.stringify(suite.startingPlayerState),
      EMPIRE_UI_PARITY_SERVER_ID: server.serverInstanceId
    }, 900_000);
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
    await runPlaywrightSuite(suite.playwrightRuns, {
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
    });
  }
  evidence.status = "passed";
} catch (error) {
  evidence.status = "failed";
  evidence.errorCode = safeErrorCode(error);
  throw error;
} finally {
  if (admin && server) {
    try {
      await archiveServer(admin, server.serverInstanceId);
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
    "--trace=on",
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

function runStagingScenario(serverInstanceId, scenario) {
  runProcess(process.execPath, [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    "tools/seed/hosted-staging-acceptance-scenario.mjs",
    `--server=${serverInstanceId}`,
    `--scenario=${scenario}`
  ], {
    environment: {
      ...sanitizedChildEnvironment(),
      NODE_ENV: "production",
      EMPIRE_RELEASE_ENVIRONMENT: "staging",
      EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
      EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED: "staging-only-fixture-write",
      EMPIRE_STAGING_DATABASE_TARGET_HASH: required(
        process.env.EMPIRE_STAGING_DATABASE_TARGET_HASH,
        "REMOTE_STAGING_DATABASE_TARGET_HASH_REQUIRED"
      ),
      EMPIRE_DATABASE_URL: required(process.env.EMPIRE_DATABASE_URL, "REMOTE_STAGING_DATABASE_URL_REQUIRED"),
      GAMEPLAY_DATABASE_URL: required(process.env.GAMEPLAY_DATABASE_URL, "REMOTE_STAGING_GAMEPLAY_DATABASE_URL_REQUIRED")
    },
    timeoutMs: 180_000
  });
}

async function restartSingleStagingWorker() {
  const app = required(process.env.FLY_STAGING_APP, "REMOTE_STAGING_FLY_APP_REQUIRED");
  required(process.env.FLY_API_TOKEN, "REMOTE_STAGING_FLY_TOKEN_REQUIRED");
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
  const healthUrl = `https://${app}.fly.dev/health`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(healthUrl, { headers: { accept: "application/json" } });
      const payload = response.ok ? await response.json() : null;
      if (payload?.status === "ok" && payload?.buildSha === releaseSha && payload?.heartbeat?.registered === true) return;
    } catch {
      // Retried below without logging remote response bodies.
    }
    await delay(5_000);
  }
  throw new Error("REMOTE_STAGING_WORKER_RESTART_HEALTH_TIMEOUT");
}

async function performServerAction(adminClient, serverInstanceId, action) {
  const controlPlane = await adminClient.request("/api/admin/control-plane");
  const current = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
  if (!current) throw new Error("REMOTE_STAGING_SERVER_MISSING");
  await adminClient.request(`/api/admin/servers/${encodeURIComponent(serverInstanceId)}/actions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `remote-staging-${action}-${randomUUID()}`
    },
    body: JSON.stringify({
      action,
      expectedVersion: current.version,
      reason: `Remote staging acceptance ${action}`,
      ...(action === "delete" ? { confirmationToken: "DELETE_SERVER" } : {})
    })
  });
}

async function waitForServerStatus(adminClient, serverInstanceId, status, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const controlPlane = await adminClient.request("/api/admin/control-plane");
    const serverRecord = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
    if (serverRecord?.status === status) return serverRecord;
    await delay(1_000);
  }
  throw new Error(`REMOTE_STAGING_SERVER_STATUS_TIMEOUT:${status}`);
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
  const controlPlane = await adminClient.request("/api/admin/control-plane");
  const current = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
  if (!current || current.status === "archived") return;
  await performServerAction(adminClient, serverInstanceId, "delete");
  await waitForServerStatus(adminClient, serverInstanceId, "archived");
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
