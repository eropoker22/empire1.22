import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { createLocalHostedAdminClient } from "./local-hosted/admin-fixture-client.mjs";
import {
  createLocalHostedEnvironment,
  LOCAL_HOSTED_API_ORIGIN,
  LOCAL_HOSTED_DATABASE_URL,
  LOCAL_HOSTED_FRONTEND_ORIGIN,
  LOCAL_HOSTED_PID_FILE,
  LOCAL_HOSTED_POSTGRES_CONTAINER,
  LOCAL_HOSTED_WORKER_ID,
  LOCAL_HOSTED_WORKER_ORIGIN
} from "./local-hosted/local-hosted-config.mjs";
import { probeRollbackOnlyTickLease } from "./hosted-preflight-tick-probe.mjs";

process.loadEnvFile?.(".env.local");
const buildSha = git(["rev-parse", "HEAD"]);
const environment = createLocalHostedEnvironment(process.env, buildSha);
const pool = new Pool({
  connectionString: LOCAL_HOSTED_DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000
});
pool.on("error", () => undefined);

const results = [];
let apiHealth = null;
let workerHealth = null;
let workerHeartbeat = null;
let controlPlane = null;

await check("PostgreSQL", async () => {
  const health = dockerInspect("{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}");
  if (health !== "healthy") throw reason(`container ${LOCAL_HOSTED_POSTGRES_CONTAINER} je ${health}`, "Spusť npm run dev:local-hosted.");
  if ((await pool.query("SELECT 1 AS value")).rows[0]?.value !== 1) {
    throw reason("canonical lokální databáze nepřijímá dotazy", "Zkontroluj Docker Desktop a port 5432.");
  }
});

await check("Migrations", async () => {
  const migrationDirectory = new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url);
  const files = (await readdir(migrationDirectory))
    .filter((filename) => /^\d{3}_.+\.sql$/u.test(filename))
    .sort();
  const applied = await pool.query("SELECT filename,checksum FROM empire_schema_migrations ORDER BY filename");
  const appliedByName = new Map(applied.rows.map((row) => [String(row.filename), String(row.checksum)]));
  const mismatch = [];
  for (const filename of files) {
    const source = await readFile(new URL(filename, migrationDirectory), "utf8");
    const checksum = createHash("sha256").update(source.replace(/\r\n/gu, "\n")).digest("hex");
    if (appliedByName.get(filename) !== checksum) mismatch.push(filename);
  }
  if (files.length !== applied.rows.length || mismatch.length) {
    throw reason(
      `pending nebo nekompatibilní migrace: ${mismatch.join(", ") || `${files.length - applied.rows.length} pending`}`,
      "Spusť npm run dev:local-hosted; supervisor provede migrace před startem."
    );
  }
});

await check("Hosted API", async () => {
  apiHealth = await json(`${LOCAL_HOSTED_API_ORIGIN}/health`);
  if (apiHealth.status !== "ready" || apiHealth.database !== "available" || apiHealth.schema !== "current") {
    throw reason("API health nepotvrdil DB a current schema", "Zobraz npm run dev:local-hosted:logs.");
  }
});

await check("Runtime Worker", async () => {
  const root = await fetch(`${LOCAL_HOSTED_WORKER_ORIGIN}/`, { cache: "no-store" });
  if (root.status !== 404) {
    throw reason(`worker root vrátil HTTP ${root.status}, očekává se 404`, "Ověř, že port 8080 nepoužívá jiná aplikace.");
  }
  workerHealth = await json(`${LOCAL_HOSTED_WORKER_ORIGIN}/health`);
  if (workerHealth.status !== "ok" || workerHealth.database !== "available"
    || workerHealth.heartbeat?.registered !== true || workerHealth.lastErrorCode !== null) {
    throw reason(
      `health=${workerHealth.status}, database=${workerHealth.database}, heartbeat=${workerHealth.heartbeat?.registered}`,
      "Zobraz worker log přes npm run dev:local-hosted:logs."
    );
  }
});

await check("Worker Heartbeat", async () => {
  const result = await pool.query(
    `SELECT worker_id,last_heartbeat_at,build_sha,status
     FROM empire_hosted_worker_heartbeats WHERE worker_id=$1`,
    [LOCAL_HOSTED_WORKER_ID]
  );
  workerHeartbeat = result.rows[0] ?? null;
  const ageMs = workerHeartbeat
    ? Date.now() - Date.parse(workerHeartbeat.last_heartbeat_at)
    : Number.POSITIVE_INFINITY;
  if (!workerHeartbeat || workerHeartbeat.status !== "online" || ageMs > 30_000) {
    throw reason(
      `heartbeat workeru ${LOCAL_HOSTED_WORKER_ID} chybí nebo je starší než 30 sekund`,
      "Restartuj canonical stack přes stop a dev:local-hosted."
    );
  }
});

await check("Build Parity", async () => {
  const values = [apiHealth?.buildSha, workerHealth?.buildSha, workerHeartbeat?.build_sha];
  if (values.some((value) => value !== buildSha)) {
    throw reason(
      `API/worker/DB heartbeat nepoužívají shodný Git SHA ${buildSha}`,
      "Zastav staré host procesy a spusť npm run dev:local-hosted."
    );
  }
});

await check("Admin", async () => {
  const admin = await createLocalHostedAdminClient({
    apiOrigin: LOCAL_HOSTED_API_ORIGIN,
    browserOrigin: LOCAL_HOSTED_FRONTEND_ORIGIN,
    username: environment.EMPIRE_ADMIN_BOOTSTRAP_USERNAME,
    password: environment.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD
  });
  controlPlane = await admin.request("/api/admin/control-plane");
  if (!controlPlane.writesEnabled || !controlPlane.provisioningEnabled
    || !controlPlane.migrationsCurrent || controlPlane.workerStatus !== "online"
    || controlPlane.buildCompatibility !== "current"
    || controlPlane.registrationEnabled !== true
    || controlPlane.unavailableCode !== null) {
    throw reason(
      `control plane není ready (${controlPlane.unavailableCode || controlPlane.workerStatus})`,
      "Zkontroluj .env.local flags a worker heartbeat."
    );
  }
});

await check("Frontend", async () => {
  for (const path of ["/pages/login.html", "/admin.html"]) {
    const response = await fetch(`${LOCAL_HOSTED_FRONTEND_ORIGIN}${path}`, { cache: "no-store" });
    if (!response.ok) {
      throw reason(`${path} vrátil HTTP ${response.status}`, "Zobraz frontend log.");
    }
  }
});

await check("Provisioning Jobs", async () => {
  const tables = await pool.query(`SELECT
    to_regclass('empire_hosted_server_provisioning_jobs') AS provisioning,
    to_regclass('empire_hosted_join_jobs') AS joins,
    to_regclass('empire_server_membership_jobs') AS memberships,
    to_regclass('empire_snapshots') AS snapshots,
    to_regclass('empire_snapshot_latest') AS recovery_heads`);
  if (Object.values(tables.rows[0] ?? {}).some((value) => !value)) {
    throw reason("chybí required control-plane nebo snapshot tabulka", "Spusť migrace přes dev:local-hosted.");
  }
  const stale = await pool.query(`SELECT
    (SELECT count(*)::int FROM empire_hosted_server_provisioning_jobs
      WHERE status='claimed' AND claimed_until < clock_timestamp()) AS provisioning,
    (SELECT count(*)::int FROM empire_hosted_join_jobs
      WHERE status='claimed' AND claimed_until < clock_timestamp()) AS joins,
    (SELECT count(*)::int FROM empire_server_membership_jobs
      WHERE status='claimed' AND claimed_until < clock_timestamp()) AS memberships,
    (SELECT count(*)::int FROM empire_hosted_server_action_requests
      WHERE status='processing' AND claimed_until < clock_timestamp()) AS actions`);
  const staleCount = Object.values(stale.rows[0] ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (staleCount > 0) {
    throw reason(`${staleCount} jobů má expirovaný claim`, "Worker musí joby znovu claimnout; zkontroluj worker log.");
  }
});

await check("Runtime Lease", async () => {
  const foreignLease = await pool.query(
    `SELECT count(*)::int AS count FROM empire_hosted_server_instances
     WHERE runtime_lease_expires_at > clock_timestamp()
       AND runtime_lease_owner_id IS DISTINCT FROM $1`,
    [LOCAL_HOSTED_WORKER_ID]
  );
  if (Number(foreignLease.rows[0]?.count || 0) > 0) {
    throw reason("aktivní server drží jiný worker", "Zastav paralelní worker a spusť canonical stack znovu.");
  }
  if (!await probeRollbackOnlyTickLease(pool)) {
    throw reason("rollback-only tick lease probe selhal", "Zkontroluj DB locks a tick owner ID.");
  }
});

await check("Supervisor", async () => {
  const state = JSON.parse(await readFile(LOCAL_HOSTED_PID_FILE, "utf8"));
  const dead = ["supervisor", "api", "worker", "frontend"].filter((name) => !isProcessAlive(state[name]));
  if (state.buildSha !== buildSha || state.databaseName !== "empire_hosted_dev" || dead.length) {
    throw reason(
      `pid state není canonical${dead.length ? `; neběží ${dead.join(", ")}` : ""}`,
      "Spusť stack pouze přes npm run dev:local-hosted."
    );
  }
});

await check("Legacy Docker", async () => {
  const status = legacyWorkerStatus();
  if (status === "running" || status === "restarting") {
    throw reason(
      "starý Docker runtime worker stále běží paralelně",
      "Zastav pouze streets-runtime-worker-1; canonical worker běží na hostu."
    );
  }
});

await pool.end();
for (const result of results) {
  console.log(`${result.label.padEnd(20, ".")} ${result.passed ? "PASS" : "FAIL"}`);
  if (!result.passed) {
    console.log(`Reason: ${result.message}`);
    console.log(`Fix: ${result.fix}`);
  }
}
const passed = results.every((result) => result.passed);
console.log(`Local Hosted ${".".repeat(7)} ${passed ? "READY" : "NOT READY"}`);
if (!passed) process.exitCode = 1;

async function check(label, operation) {
  try {
    await operation();
    results.push({ label, passed: true, message: "", fix: "" });
  } catch (error) {
    const details = error && typeof error === "object" ? error : {};
    results.push({
      label,
      passed: false,
      message: details.message || String(error),
      fix: details.fix || "Zobraz lokální logy a oprav uvedenou příčinu."
    });
  }
}

async function json(url) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw reason(`${url} vrátil HTTP ${response.status}`, "Zkontroluj lokální proces a port.");
  }
  return payload;
}

function dockerInspect(template) {
  try {
    return execFileSync("docker", ["inspect", "--format", template, LOCAL_HOSTED_POSTGRES_CONTAINER], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "missing";
  }
}

function legacyWorkerStatus() {
  try {
    return execFileSync("docker", [
      "inspect",
      "--format",
      "{{.State.Status}}",
      "streets-runtime-worker-1"
    ], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "missing";
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return Number.isSafeInteger(Number(pid)) && Number(pid) > 0;
  } catch {
    return false;
  }
}

function reason(message, fix) {
  return Object.assign(new Error(message), { fix });
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    windowsHide: true
  }).trim();
}
