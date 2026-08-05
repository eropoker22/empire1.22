import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createLocalHostedAdminClient,
  provisionDisposableHostedServer,
  startDisposableHostedServer
} from "./local-hosted/admin-fixture-client.mjs";
import { delay } from "./local-hosted/process-supervisor.mjs";
import { validateProductionReleaseSmokeEnvironment } from "./production-release-smoke-contract.mjs";
import { validateRemoteReleaseHealth } from "./remote-release-contract.mjs";

const root = process.cwd();
const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const config = validateProductionReleaseSmokeEnvironment(process.env, { gitSha: checkoutSha });
const worktreeStatus = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=all"],
  { cwd: root, encoding: "utf8" }
).trim();
if (worktreeStatus) throw new Error("PRODUCTION_SMOKE_WORKTREE_DIRTY");

const releaseManifest = JSON.parse(readFileSync(path.join(root, "artifacts/release-manifest.json"), "utf8"));
if (releaseManifest.environment !== "production"
  || releaseManifest.gitSha !== config.buildSha
  || releaseManifest.frontendBuildSha !== config.buildSha
  || releaseManifest.apiBuildSha !== config.buildSha
  || releaseManifest.workerBuildSha !== config.buildSha) {
  throw new Error("PRODUCTION_SMOKE_MANIFEST_MISMATCH");
}
const expectedSchemaVersion = String(releaseManifest.expectedSchemaVersion ?? "");
const artifactDirectory = path.resolve(root, config.artifactRoot);
mkdirSync(artifactDirectory, { recursive: true });

const evidence = {
  checkedAt: new Date().toISOString(),
  buildSha: config.buildSha,
  environment: "production",
  publicOrigin: config.publicOrigin,
  workerOrigin: config.workerOrigin,
  schemaVersion: expectedSchemaVersion,
  status: "running",
  registration: "pending",
  staleServersArchived: 0,
  serverInstanceHash: null,
  initialSnapshotHash: null,
  finalSnapshotHash: null,
  cleanup: "not-started",
  playwrightRuns: []
};

let admin = null;
let server = null;
try {
  evidence.health = await verifyRemoteHealth();
  await verifyRegistrationClosed();
  evidence.registration = "closed";

  admin = await createLocalHostedAdminClient({
    apiOrigin: config.publicOrigin,
    browserOrigin: config.publicOrigin,
    username: config.adminUsername,
    password: String(process.env.PRODUCTION_ADMIN_PASSWORD)
  });
  evidence.staleServersArchived = await archiveStaleSmokeServers(admin);
  server = await provisionDisposableHostedServer(admin, {
    displayNamePrefix: "Production Release Smoke",
    capacity: 5,
    idempotencyPrefix: "production-smoke",
    registrationReason: "Production release smoke registration"
  });
  evidence.serverInstanceHash = safeHash(server.serverInstanceId);
  const initialControl = await requireCurrentControlPlane(admin);
  const initialServer = requireServer(initialControl, server.serverInstanceId);
  if (!initialServer.currentSnapshotId) throw new Error("PRODUCTION_SMOKE_INITIAL_SNAPSHOT_MISSING");
  evidence.initialSnapshotHash = safeHash(initialServer.currentSnapshotId);

  await runPlaywright("bootstrap", "tests/e2e/production-release-bootstrap.spec.js", server.serverInstanceId);
  await startDisposableHostedServer(admin, server.serverInstanceId, {
    idempotencyPrefix: "production-smoke",
    reason: "Production release smoke canonical start"
  });
  await runPlaywright("income", "tests/e2e/production-release-income.spec.js", server.serverInstanceId);

  const finalControl = await requireCurrentControlPlane(admin);
  const finalServer = requireServer(finalControl, server.serverInstanceId);
  if (finalServer.status !== "running"
    || finalServer.provisioningState !== "ready"
    || Number(finalServer.readyPlayers ?? 0) < 1
    || !finalServer.currentSnapshotId
    || finalServer.currentSnapshotId === initialServer.currentSnapshotId
    || !freshIso(finalServer.lastWorkerHeartbeatAt, 60_000)) {
    throw new Error("PRODUCTION_SMOKE_SERVER_HEALTH_INVALID");
  }
  evidence.finalSnapshotHash = safeHash(finalServer.currentSnapshotId);
  evidence.controlPlane = {
    buildCompatibility: finalControl.buildCompatibility,
    migrationsCurrent: finalControl.migrationsCurrent,
    originPolicy: finalControl.originPolicy,
    registrationEnabled: finalControl.registrationEnabled,
    sessionSecurity: finalControl.sessionSecurity,
    workerStatus: finalControl.workerStatus
  };
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
  evidence.durationMs = Date.now() - Date.parse(evidence.checkedAt);
  writeFileSync(
    path.join(artifactDirectory, "summary.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );
}

async function verifyRemoteHealth() {
  const [api, worker, servers] = await Promise.all([
    fetchJson(config.publicOrigin, "/api/health"),
    fetchJson(config.workerOrigin, "/health"),
    fetchJson(config.publicOrigin, "/api/servers")
  ]);
  if (servers?.accepted !== true || !Array.isArray(servers?.data?.servers)) {
    throw new Error("PRODUCTION_SMOKE_SERVERS_READ_INVALID");
  }
  return validateRemoteReleaseHealth({
    api,
    worker,
    expectedSha: config.buildSha,
    expectedSchemaVersion,
    expectedEnvironment: "production",
    expectedRegion: config.runtimeRegion
  });
}

async function verifyRegistrationClosed() {
  const policy = await fetchJson(config.publicOrigin, "/api/account/registration-policy");
  if (policy?.accepted !== true
    || policy?.data?.registrationEnabled !== false
    || policy?.data?.mode !== "closed") {
    throw new Error("PRODUCTION_SMOKE_REGISTRATION_POLICY_OPEN");
  }
}

async function requireCurrentControlPlane(adminClient) {
  const controlPlane = await adminClient.request("/api/admin/control-plane");
  if (controlPlane.workerStatus !== "online"
    || controlPlane.migrationsCurrent !== true
    || controlPlane.buildCompatibility !== "current"
    || controlPlane.sessionSecurity !== "current"
    || controlPlane.originPolicy !== "current"
    || controlPlane.registrationEnabled !== false
    || controlPlane.apiBuildSha !== config.buildSha
    || controlPlane.workerBuildSha !== config.buildSha
    || controlPlane.schemaVersion !== expectedSchemaVersion) {
    throw new Error("PRODUCTION_SMOKE_CONTROL_PLANE_INVALID");
  }
  return controlPlane;
}

function requireServer(controlPlane, serverInstanceId) {
  const record = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
  if (!record) throw new Error("PRODUCTION_SMOKE_SERVER_MISSING");
  return record;
}

async function archiveStaleSmokeServers(adminClient) {
  const controlPlane = await requireCurrentControlPlane(adminClient);
  const stale = controlPlane.servers.filter((candidate) => (
    candidate.displayName.startsWith("Production Release Smoke ")
    && candidate.status !== "archived"
  ));
  for (const candidate of stale) await archiveServer(adminClient, candidate.serverInstanceId);
  return stale.length;
}

async function archiveServer(adminClient, serverInstanceId) {
  const controlPlane = await adminClient.request("/api/admin/control-plane");
  const current = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
  if (!current || current.status === "archived") return;
  await adminClient.request(`/api/admin/servers/${encodeURIComponent(serverInstanceId)}/actions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `production-smoke-delete-${randomUUID()}`
    },
    body: JSON.stringify({
      action: "delete",
      expectedVersion: current.version,
      reason: "Production release smoke cleanup",
      confirmationToken: "DELETE_SERVER"
    })
  });
  await waitForServerStatus(adminClient, serverInstanceId, "archived");
}

async function waitForServerStatus(adminClient, serverInstanceId, status, timeoutMs = 180_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const controlPlane = await adminClient.request("/api/admin/control-plane");
    const current = controlPlane.servers.find((candidate) => candidate.serverInstanceId === serverInstanceId);
    if (current?.status === status) return;
    await delay(1_000);
  }
  throw new Error(`PRODUCTION_SMOKE_SERVER_STATUS_TIMEOUT:${status}`);
}

function runPlaywright(name, spec, serverInstanceId) {
  const outputDirectory = path.join(artifactDirectory, "playwright", name);
  const summaryPath = path.join(artifactDirectory, `${name}-release-summary.json`);
  mkdirSync(outputDirectory, { recursive: true });
  const result = spawnSync(process.execPath, [
    "scripts/run-local-bin.mjs",
    "playwright/cli.js",
    "test",
    "--project=chromium",
    "--workers=1",
    "--trace=off",
    "--forbid-only",
    "--fail-on-flaky-tests",
    "--retries=0",
    `--output=${outputDirectory}`,
    "--reporter=./scripts/playwright-release-reporter.mjs",
    spec
  ], {
    cwd: root,
    env: {
      ...sanitizedChildEnvironment(),
      CI: "1",
      NODE_ENV: "production",
      EMPIRE_RELEASE_ENVIRONMENT: "production",
      EMPIRE_PUBLIC_ORIGIN: config.publicOrigin,
      EMPIRE_PRODUCTION_REMOTE_SMOKE: "1",
      EMPIRE_UI_PARITY_SERVER_ID: serverInstanceId,
      EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY: summaryPath,
      PLAYWRIGHT_E2E_BASE_URL: config.publicOrigin,
      PLAYWRIGHT_E2E_HEALTH_URL: `${config.publicOrigin}/api/servers`,
      PLAYWRIGHT_SKIP_WEB_SERVER: "1",
      PRODUCTION_SMOKE_ACCOUNT_USERNAME: config.smokeUsername,
      PRODUCTION_SMOKE_ACCOUNT_PASSWORD: String(process.env.PRODUCTION_SMOKE_ACCOUNT_PASSWORD)
    },
    stdio: "inherit",
    timeout: 600_000,
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    throw new Error(`PRODUCTION_SMOKE_PLAYWRIGHT_COMMAND_FAILED:${name}:${result.status ?? "spawn"}`);
  }
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  if (summary.status !== "passed"
    || summary.counts?.skipped !== 0
    || summary.counts?.notRun !== 0
    || summary.counts?.retries !== 0) {
    throw new Error(`PRODUCTION_SMOKE_PLAYWRIGHT_NOT_PASSED:${name}`);
  }
  evidence.playwrightRuns.push({
    name,
    summaryPath: path.relative(root, summaryPath).replace(/\\/gu, "/"),
    ...summary
  });
}

async function fetchJson(origin, pathname) {
  const response = await fetch(new URL(pathname, origin), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: { accept: "application/json", "cache-control": "no-cache" }
  });
  if (!response.ok || new URL(response.url).origin !== origin) {
    throw new Error(`PRODUCTION_SMOKE_FETCH_FAILED:${pathname}:${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`PRODUCTION_SMOKE_JSON_INVALID:${pathname}`);
  }
}

function sanitizedChildEnvironment() {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/(?:SECRET|PASSWORD|TOKEN|PEPPER|DATABASE_URL)/u.test(name)) delete environment[name];
  }
  return environment;
}

function freshIso(value, maximumAgeMs) {
  const timestamp = Date.parse(String(value ?? ""));
  const ageMs = Date.now() - timestamp;
  return Number.isFinite(timestamp) && ageMs >= -5_000 && ageMs <= maximumAgeMs;
}

function safeHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function safeErrorCode(error) {
  return String(error?.message ?? error ?? "PRODUCTION_SMOKE_UNKNOWN_ERROR")
    .split(":", 1)[0]
    .replace(/[^A-Z0-9_.-]/giu, "_")
    .slice(0, 120);
}
