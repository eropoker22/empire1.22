import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  createLocalHostedAdminClient,
  provisionDisposableHostedServer,
  startDisposableHostedServer
} from "./local-hosted/admin-fixture-client.mjs";
import { delay } from "./local-hosted/process-supervisor.mjs";
import { REMOTE_MANUAL_STARTING_PLAYER_STATE } from "./remote-staging-acceptance-suites.mjs";
import { assertSafeRemoteStagingFixtureEnvironment } from "./remote-staging-fixture-safety.mjs";
import {
  summarizeDatabaseTelemetry,
  summarizeFlyTelemetry
} from "./remote-staging-load-metrics.mjs";
import {
  archiveRemoteStagingServerWithRetry,
  assertPinnedRemoteStagingFlyApp,
  REMOTE_STAGING_PLAYWRIGHT_TRACE_ARGUMENT
} from "./remote-staging-runner-safety.mjs";
import { assertSupportedNodeVersion } from "./supported-node-policy.mjs";

const { Pool } = pg;
assertSupportedNodeVersion(process.versions.node);
const root = process.cwd();
const releaseSha = exactSha(process.env.EMPIRE_BUILD_SHA);
const checkoutSha = exactSha(execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim());
if (releaseSha !== checkoutSha) throw new Error("REMOTE_LOAD_BUILD_SHA_MISMATCH");
if (execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" }).trim()) {
  throw new Error("REMOTE_LOAD_WORKTREE_DIRTY");
}
const flyApp = assertPinnedRemoteStagingFlyApp({
  app: required(process.env.FLY_STAGING_APP, "REMOTE_LOAD_FLY_APP_REQUIRED"),
  pinnedApp: required(process.env.EMPIRE_PRE_ALPHA_STAGING_FLY_APP, "REMOTE_LOAD_FLY_APP_PIN_REQUIRED")
});
const publicOrigin = exactOrigin(process.env.EMPIRE_PUBLIC_ORIGIN, "https://staging.empirestreets.cz");
const workerOrigin = exactOrigin(
  process.env.EMPIRE_HOSTED_WORKER_ORIGIN,
  `https://${flyApp}.fly.dev`
);
if (process.env.NODE_ENV !== "production" || process.env.EMPIRE_RELEASE_ENVIRONMENT !== "staging") {
  throw new Error("REMOTE_LOAD_ENVIRONMENT_INVALID");
}
const durationMinutes = integerInRange(process.env.EMPIRE_REMOTE_LOAD_SOAK_MINUTES, 60, 360, "REMOTE_LOAD_DURATION_INVALID");
const maximumDbConnections = integerInRange(process.env.EMPIRE_REMOTE_MAX_DB_CONNECTIONS, 1, 10_000, "REMOTE_LOAD_DB_THRESHOLD_INVALID");
const flyThresholds = {
  maxMemoryBytes: integerInRange(process.env.EMPIRE_REMOTE_MAX_WORKER_MEMORY_BYTES, 1, Number.MAX_SAFE_INTEGER, "REMOTE_LOAD_MEMORY_THRESHOLD_INVALID"),
  maxCpuPct: numberInRange(process.env.EMPIRE_REMOTE_MAX_WORKER_CPU_PCT, 0.01, 100, "REMOTE_LOAD_CPU_THRESHOLD_INVALID"),
  maxThrottleIncrease: numberInRange(process.env.EMPIRE_REMOTE_MAX_WORKER_THROTTLE_INCREASE, 0, Number.MAX_SAFE_INTEGER, "REMOTE_LOAD_THROTTLE_THRESHOLD_INVALID")
};
const flyOrgSlug = identifier(process.env.FLY_ORG_SLUG, "REMOTE_LOAD_FLY_ORG_REQUIRED");
const flyMetricsAuthorization = metricsAuthorization(process.env.FLY_METRICS_TOKEN);
const databaseUrl = required(process.env.EMPIRE_DATABASE_URL, "REMOTE_LOAD_DATABASE_URL_REQUIRED");
assertSafeRemoteStagingFixtureEnvironment({
  ...process.env,
  NODE_ENV: "production",
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
  EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED: "staging-only-fixture-write",
  EMPIRE_DATABASE_URL: databaseUrl,
  GAMEPLAY_DATABASE_URL: required(process.env.GAMEPLAY_DATABASE_URL, "REMOTE_LOAD_GAMEPLAY_DATABASE_URL_REQUIRED")
});
const adminUsername = required(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME, "REMOTE_LOAD_ADMIN_USERNAME_REQUIRED");
const adminPassword = required(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD, "REMOTE_LOAD_ADMIN_PASSWORD_REQUIRED");
const artifactDirectory = path.resolve(
  String(process.env.EMPIRE_REMOTE_STAGING_ARTIFACT_ROOT || "artifacts/remote-staging/load-soak")
);
mkdirSync(artifactDirectory, { recursive: true });

const evidence = {
  buildSha: releaseSha,
  environment: "staging",
  durationMinutes,
  status: "running",
  serverInstanceHash: null,
  browser: null,
  performance: null,
  database: null,
  fly: null,
  cleanup: "not-started"
};
let admin = null;
let server = null;
let cleanupServerInstanceId = null;
const startedAt = Date.now();
try {
  admin = await createLocalHostedAdminClient({
    apiOrigin: publicOrigin,
    browserOrigin: publicOrigin,
    username: adminUsername,
    password: adminPassword
  });
  const identities = createIdentities(20);
  server = await provisionDisposableHostedServer(admin, {
    displayNamePrefix: "Remote Staging Acceptance load-soak",
    capacity: 20,
    startingPlayerState: REMOTE_MANUAL_STARTING_PLAYER_STATE,
    onCreated: ({ serverInstanceId }) => {
      cleanupServerInstanceId = serverInstanceId;
      evidence.serverInstanceHash = safeHash(serverInstanceId);
    }
  });
  cleanupServerInstanceId ??= server.serverInstanceId;
  evidence.serverInstanceHash ??= safeHash(server.serverInstanceId);
  await runReleasePlaywright({
    name: "load-soak-bootstrap",
    specs: ["tests/e2e/local-hosted-bootstrap-player.spec.js"],
    timeoutMs: 1_800_000,
    environment: {
      ...publicBrowserEnvironment(),
      EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON: JSON.stringify(identities),
      EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON: JSON.stringify(REMOTE_MANUAL_STARTING_PLAYER_STATE),
      EMPIRE_UI_PARITY_SERVER_ID: server.serverInstanceId
    }
  });
  await startDisposableHostedServer(admin, server.serverInstanceId);
  const loadReportPath = path.join(artifactDirectory, "load-soak-browser.json");
  const loadResult = await runLoadPlaywrightWithDatabaseTelemetry({
    identities,
    serverInstanceId: server.serverInstanceId,
    loadReportPath
  });
  evidence.browser = loadResult.playwright;
  evidence.performance = loadResult.performance;
  evidence.database = loadResult.database;
  evidence.fly = loadResult.fly;
  if (!loadResult.database.passed) throw new Error(loadResult.database.violations[0]);
  if (!loadResult.fly.passed) throw new Error(loadResult.fly.violations[0]);
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
      if (evidence.status === "passed") process.exitCode = 1;
    }
  }
  evidence.durationMs = Date.now() - startedAt;
  writeFileSync(path.join(artifactDirectory, "summary.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

async function runLoadPlaywrightWithDatabaseTelemetry({ identities, serverInstanceId, loadReportPath }) {
  const name = "load-soak";
  const outputDirectory = path.join(artifactDirectory, "playwright", name);
  const summaryPath = path.join(artifactDirectory, `${name}-release-summary.json`);
  mkdirSync(outputDirectory, { recursive: true });
  const child = spawn(process.execPath, [
    "scripts/run-local-bin.mjs",
    "playwright/cli.js",
    "test",
    "--project=chromium",
    "--workers=1",
    // This process receives synthetic passwords and authenticated cookies.
    // Screenshots remain enabled by Playwright config, but traces must not persist them.
    REMOTE_STAGING_PLAYWRIGHT_TRACE_ARGUMENT,
    "--forbid-only",
    "--fail-on-flaky-tests",
    "--retries=0",
    `--output=${outputDirectory}`,
    "--reporter=./scripts/playwright-release-reporter.mjs",
    "tests/e2e/remote-staging-load-soak.spec.js"
  ], {
    cwd: root,
    env: {
      ...sanitizedChildEnvironment(),
      ...publicBrowserEnvironment(),
      EMPIRE_REMOTE_STAGING_LOAD_SOAK: "1",
      EMPIRE_REMOTE_LOAD_SOAK_MINUTES: String(durationMinutes),
      EMPIRE_REMOTE_LOAD_POLL_INTERVAL_MS: "30000",
      EMPIRE_REMOTE_LOAD_REPORT_PATH: loadReportPath,
      EMPIRE_HOSTED_WORKER_ORIGIN: workerOrigin,
      EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON: JSON.stringify(identities),
      EMPIRE_UI_PARITY_SERVER_ID: serverInstanceId,
      EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY: summaryPath
    },
    stdio: "inherit",
    windowsHide: true
  });
  let exited = false;
  let exitCode = null;
  const exitPromise = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      exited = true;
      exitCode = code ?? (signal ? 1 : 0);
      resolve();
    });
  });
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    query_timeout: 15_000,
    application_name: "empire_remote_staging_load_telemetry"
  });
  const databaseSamples = [];
  const flySamples = [];
  try {
    while (!exited) {
      const [databaseSample, flySample] = await Promise.all([
        captureTelemetrySample("REMOTE_LOAD_DB_TELEMETRY_ERROR", () => sampleDatabase(pool)),
        captureTelemetrySample("REMOTE_LOAD_FLY_TELEMETRY_ERROR", sampleFlyMetrics)
      ]);
      databaseSamples.push(databaseSample);
      flySamples.push(flySample);
      await Promise.race([exitPromise, delay(60_000)]);
    }
    await exitPromise;
  } finally {
    await pool.end();
  }
  const database = summarizeDatabaseTelemetry(databaseSamples, maximumDbConnections);
  const fly = summarizeFlyTelemetry(flySamples, flyThresholds);
  writeFileSync(path.join(artifactDirectory, "load-soak-database.json"), `${JSON.stringify({
    checkedAt: new Date().toISOString(),
    environment: "staging",
    buildSha: releaseSha,
    summary: database,
    samples: databaseSamples
  }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(artifactDirectory, "load-soak-fly.json"), `${JSON.stringify({
    checkedAt: new Date().toISOString(),
    environment: "staging",
    buildSha: releaseSha,
    summary: fly,
    samples: flySamples
  }, null, 2)}\n`, "utf8");
  if (exitCode !== 0) throw new Error(`REMOTE_LOAD_PLAYWRIGHT_FAILED:${exitCode}`);
  const playwright = JSON.parse(readFileSync(summaryPath, "utf8"));
  if (playwright.status !== "passed" || playwright.counts?.skipped !== 0 || playwright.counts?.retries !== 0) {
    throw new Error("REMOTE_LOAD_PLAYWRIGHT_NOT_PASSED");
  }
  let performanceReport;
  try {
    performanceReport = JSON.parse(readFileSync(loadReportPath, "utf8"));
  } catch {
    throw new Error("REMOTE_LOAD_PERFORMANCE_REPORT_MISSING");
  }
  if (performanceReport?.status !== "passed"
    || performanceReport?.environment !== "staging"
    || performanceReport?.buildSha !== releaseSha
    || performanceReport?.metrics?.passed !== true
    || !Array.isArray(performanceReport?.metrics?.violations)
    || performanceReport.metrics.violations.length !== 0
    || Number(performanceReport?.metrics?.actionMix?.distinctActualActionCount) < 5
    || Number(performanceReport?.metrics?.actionMix?.distinctAcceptedActionCount) < 4
    || Number(performanceReport?.metrics?.actionMix?.districtSelectionChangeCount) < 1
    || Number(performanceReport?.metrics?.rejectionClassification?.auth) !== 0
    || Number(performanceReport?.metrics?.rejectionClassification?.rateLimit) !== 0
    || Number(performanceReport?.metrics?.rejectionClassification?.unexpected) !== 0) {
    throw new Error("REMOTE_LOAD_PERFORMANCE_NOT_PASSED");
  }
  const performance = {
    status: performanceReport.status,
    buildSha: performanceReport.buildSha,
    durationMinutes: performanceReport.durationMinutes,
    pollIntervalMs: performanceReport.pollIntervalMs,
    cohorts: performanceReport.cohorts,
    metrics: performanceReport.metrics
  };
  return { playwright, performance, database, fly };
}

async function sampleDatabase(pool) {
  const started = performance.now();
  const [activity, maximum, timeout] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE state='active')::int AS active
      FROM pg_stat_activity WHERE datname=current_database()`),
    pool.query("SHOW max_connections"),
    pool.query("SHOW statement_timeout")
  ]);
  return {
    checkedAt: new Date().toISOString(),
    connectionCount: Number(activity.rows[0]?.total || 0),
    activeConnectionCount: Number(activity.rows[0]?.active || 0),
    serverMaxConnections: Number(maximum.rows[0]?.max_connections || 0),
    statementTimeout: String(timeout.rows[0]?.statement_timeout || ""),
    probeDurationMs: Math.max(0, performance.now() - started)
  };
}

async function sampleFlyMetrics() {
  const started = performance.now();
  const selector = `{app="${flyApp}"}`;
  const [memoryUsedBytes, cpuUsedPct, cpuThrottleIncrease, appConcurrency] = await Promise.all([
    queryFlyMetric(`max(fly_instance_memory_mem_total${selector} - fly_instance_memory_mem_available${selector})`),
    queryFlyMetric(`100 * (1 - sum(rate(fly_instance_cpu{app="${flyApp}",mode="idle"}[2m])) / sum(rate(fly_instance_cpu${selector}[2m])))`),
    queryFlyMetric(`sum(increase(fly_instance_cpu_throttle${selector}[2m]))`),
    queryFlyMetric(`max(fly_app_concurrency${selector})`)
  ]);
  return {
    checkedAt: new Date().toISOString(),
    memoryUsedBytes,
    cpuUsedPct,
    cpuThrottleIncrease,
    appConcurrency,
    queryDurationMs: Math.max(0, performance.now() - started)
  };
}

async function queryFlyMetric(query) {
  const endpoint = new URL(`https://api.fly.io/prometheus/${flyOrgSlug}/api/v1/query`);
  endpoint.searchParams.set("query", query);
  const response = await fetch(endpoint, {
    headers: { authorization: flyMetricsAuthorization, accept: "application/json" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`REMOTE_LOAD_FLY_METRICS_HTTP_${response.status}`);
  const payload = await response.json();
  if (payload?.status !== "success") throw new Error("REMOTE_LOAD_FLY_METRICS_INVALID");
  const values = (payload?.data?.result || [])
    .map((entry) => Number(entry?.value?.[1]))
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

async function captureTelemetrySample(errorCode, sampler) {
  try {
    return await sampler();
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      errorCode,
      providerErrorCode: safeErrorCode(error)
    };
  }
}

async function runReleasePlaywright({ name, specs, environment, timeoutMs }) {
  const outputDirectory = path.join(artifactDirectory, "playwright", name);
  const summaryPath = path.join(artifactDirectory, `${name}-release-summary.json`);
  mkdirSync(outputDirectory, { recursive: true });
  const result = await spawnAndWait(process.execPath, [
    "scripts/run-local-bin.mjs",
    "playwright/cli.js",
    "test",
    "--project=chromium",
    "--workers=1",
    // Bootstrap receives all 20 synthetic passwords; never persist its browser context.
    REMOTE_STAGING_PLAYWRIGHT_TRACE_ARGUMENT,
    "--forbid-only",
    "--fail-on-flaky-tests",
    "--retries=0",
    `--output=${outputDirectory}`,
    "--reporter=./scripts/playwright-release-reporter.mjs",
    ...specs
  ], {
    ...sanitizedChildEnvironment(),
    ...environment,
    EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY: summaryPath
  }, timeoutMs);
  if (result !== 0) throw new Error(`REMOTE_LOAD_BOOTSTRAP_FAILED:${result}`);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  if (summary.status !== "passed") throw new Error("REMOTE_LOAD_BOOTSTRAP_NOT_PASSED");
}

function spawnAndWait(command, args, environment, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: environment, stdio: "inherit", windowsHide: true });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("REMOTE_LOAD_COMMAND_TIMEOUT"));
    }, timeoutMs);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function requestServerAction(adminClient, serverInstanceId, action, expectedVersion) {
  await adminClient.request(`/api/admin/servers/${encodeURIComponent(serverInstanceId)}/actions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `remote-load-${action}-${randomUUID()}`
    },
    body: JSON.stringify({
      action,
      expectedVersion,
      reason: `Remote staging load soak ${action}`,
      ...(action === "delete" ? { confirmationToken: "DELETE_SERVER" } : {})
    })
  });
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

function publicBrowserEnvironment() {
  return {
    NODE_ENV: "production",
    EMPIRE_RELEASE_ENVIRONMENT: "staging",
    EMPIRE_PUBLIC_ORIGIN: publicOrigin,
    EMPIRE_BUILD_SHA: releaseSha,
    PLAYWRIGHT_E2E_BASE_URL: publicOrigin,
    PLAYWRIGHT_E2E_HEALTH_URL: `${publicOrigin}/api/servers`,
    PLAYWRIGHT_SKIP_WEB_SERVER: "1",
    EMPIRE_HOSTED_UI_PARITY_E2E: "1"
  };
}

function createIdentities(count) {
  return Array.from({ length: count }, (_, index) => {
    const suffix = randomBytes(6).toString("hex");
    return {
      username: `RemoteLoad${index + 1}${suffix}`.slice(0, 32),
      gangName: `Remote Load ${index + 1} ${suffix}`.slice(0, 48),
      password: randomBytes(24).toString("base64url"),
      networkIdentifier: `2001:db8::${randomBytes(8).toString("hex")}`
    };
  });
}

function sanitizedChildEnvironment() {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/(?:SECRET|PASSWORD|TOKEN|PEPPER|DATABASE_URL)/u.test(name)) delete environment[name];
  }
  return environment;
}
function exactOrigin(value, expected) {
  if (value !== expected) throw new Error("REMOTE_LOAD_ORIGIN_INVALID");
  return expected;
}
function exactSha(value) {
  const normalized = String(value ?? "").trim();
  if (!/^[0-9a-f]{40}$/u.test(normalized)) throw new Error("REMOTE_LOAD_BUILD_SHA_INVALID");
  return normalized;
}
function required(value, code) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}
function integerInRange(value, minimum, maximum, code) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(code);
  return parsed;
}
function numberInRange(value, minimum, maximum, code) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(code);
  return parsed;
}
function identifier(value, code) {
  const normalized = required(value, code);
  if (!/^[a-z0-9-]{1,63}$/u.test(normalized)) throw new Error(code);
  return normalized;
}
function metricsAuthorization(value) {
  const token = required(value, "REMOTE_LOAD_FLY_METRICS_TOKEN_REQUIRED");
  if (token.startsWith("Bearer ") || token.startsWith("FlyV1 ")) return token;
  return `Bearer ${token}`;
}
function safeHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}
function safeErrorCode(error) {
  return String(error?.message ?? error ?? "REMOTE_LOAD_UNKNOWN_ERROR").split(":", 1)[0].replace(/[^A-Z0-9_.-]/giu, "_").slice(0, 120);
}
