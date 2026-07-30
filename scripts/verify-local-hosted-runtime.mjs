import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { BROWSER_GAMEPLAY_CONFIG } from "../packages/game-config/src/legacy-page/gameplay-config.generated.js";
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

const generatedFreeTickRateMs = Number(BROWSER_GAMEPLAY_CONFIG.cityEvents?.tickRateMs);
if (!Number.isSafeInteger(generatedFreeTickRateMs) || generatedFreeTickRateMs <= 0) {
  throw new Error("Canonical Free tick rate is missing from the generated gameplay config.");
}

export const CANONICAL_FREE_TICK_RATE_MS = generatedFreeTickRateMs;

const RUNNING_STATUS = "running";
const PRE_SNAPSHOT_STATUSES = new Set(["requested", "provisioning"]);
const INSTANCE_RESULT_LABELS = [
  "Server status",
  "Worker heartbeat",
  "Runtime lease",
  "Tick advancing",
  "State version",
  "Recovery head",
  "Snapshot freshness",
  "Gameplay load/submit"
];

export const parseInstanceArgument = (argv) => {
  let instanceId = null;
  for (const argument of argv) {
    if (!argument.startsWith("--instance=")) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    if (instanceId !== null) {
      throw new Error("--instance may only be provided once.");
    }
    const candidate = argument.slice("--instance=".length).trim();
    if (!/^[a-z0-9][a-z0-9:._-]{0,255}$/iu.test(candidate)) {
      throw new Error("--instance requires a valid serverInstanceId.");
    }
    instanceId = candidate;
  }
  return instanceId;
};

export const resolveInstanceTickRateMs = (
  value,
  fallbackTickRateMs = CANONICAL_FREE_TICK_RATE_MS
) => {
  const tickRateMs = Number(value);
  return Number.isSafeInteger(tickRateMs) && tickRateMs > 0
    ? tickRateMs
    : fallbackTickRateMs;
};

export const resolveInstancePollPolicy = (tickRateValue) => {
  const tickRateMs = resolveInstanceTickRateMs(tickRateValue);
  return {
    tickRateMs,
    pollIntervalMs: Math.max(250, Math.ceil(tickRateMs / 4)),
    timeoutMs: tickRateMs * 3,
    snapshotFreshnessMaxAgeMs: tickRateMs * 3
  };
};

export const evaluateInstanceAdvancement = (before, after) => {
  const tickFields = ["instanceTick", "snapshotTick", "rootTick"];
  const missingTickFields = tickFields.filter((field) =>
    !isCounter(before?.[field]) || !isCounter(after?.[field]));
  const stalledTickFields = tickFields.filter((field) =>
    isCounter(before?.[field]) && isCounter(after?.[field]) && after[field] <= before[field]);
  const stateVersionAvailable = isCounter(before?.stateVersion) && isCounter(after?.stateVersion);
  return {
    tickAdvanced: missingTickFields.length === 0 && stalledTickFields.length === 0,
    stateVersionAdvanced: stateVersionAvailable && after.stateVersion > before.stateVersion,
    missingTickFields,
    stalledTickFields,
    stateVersionAvailable
  };
};

export const evaluateRecoveryHead = (observation) => {
  const status = String(observation?.status ?? "").toLowerCase();
  if (!observation?.snapshotId) {
    if (PRE_SNAPSHOT_STATUSES.has(status)) {
      return {
        outcome: "NOT AVAILABLE",
        message: `status=${status}; recovery head is not expected before provisioning completes`
      };
    }
    return { outcome: "FAIL", message: "recovery head is missing" };
  }

  const mismatches = [];
  compareCounters(mismatches, "snapshot tick/payload tick", observation.snapshotTick, observation.payloadTick);
  compareCounters(mismatches, "snapshot tick/root tick", observation.snapshotTick, observation.rootTick);
  compareCounters(mismatches, "root version/integrity version", observation.rootVersion, observation.integrityRootVersion);
  compareCounters(mismatches, "root version/state version", observation.rootVersion, observation.stateVersion);
  if (observation.snapshotServerInstanceId !== observation.serverInstanceId) {
    mismatches.push("snapshot serverInstanceId");
  }
  return mismatches.length
    ? { outcome: "FAIL", message: `recovery head mismatch: ${mismatches.join(", ")}` }
    : {
        outcome: "PASS",
        message: `snapshot=${observation.snapshotId}; tick=${observation.snapshotTick}; version=${observation.rootVersion}`
      };
};

export const evaluateSnapshotFreshness = ({
  status,
  snapshotCreatedAt,
  nowMs = Date.now(),
  tickRateMs
}) => {
  const normalizedStatus = String(status ?? "").toLowerCase();
  if (!snapshotCreatedAt) {
    if (PRE_SNAPSHOT_STATUSES.has(normalizedStatus)) {
      return {
        outcome: "NOT AVAILABLE",
        message: `status=${normalizedStatus}; snapshot is not expected yet`
      };
    }
    return { outcome: "FAIL", message: "snapshot timestamp is missing" };
  }
  const snapshotMs = Date.parse(snapshotCreatedAt);
  if (!Number.isFinite(snapshotMs)) {
    return { outcome: "FAIL", message: "snapshot timestamp is invalid" };
  }
  const ageMs = Math.max(0, nowMs - snapshotMs);
  if (normalizedStatus !== RUNNING_STATUS) {
    return {
      outcome: "PASS",
      message: `status=${normalizedStatus}; age=${ageMs}ms; freshness advancement is not required`
    };
  }
  const maximumAgeMs = resolveInstancePollPolicy(tickRateMs).snapshotFreshnessMaxAgeMs;
  return ageMs <= maximumAgeMs
    ? { outcome: "PASS", message: `age=${ageMs}ms; maximum=${maximumAgeMs}ms` }
    : { outcome: "FAIL", message: `age=${ageMs}ms exceeds ${maximumAgeMs}ms` };
};

async function main() {
  let requestedInstanceId;
  try {
    requestedInstanceId = parseInstanceArgument(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Usage: npm run verify:local-hosted-runtime -- --instance=<serverInstanceId>");
    process.exitCode = 1;
    return;
  }

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
  let instanceResults = [];
  let apiHealth = null;
  let workerHealth = null;
  let workerHeartbeat = null;
  let controlPlane = null;
  const check = async (label, operation) => {
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
  };

  try {
    await check("PostgreSQL", async () => {
      const health = dockerInspect("{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}");
      if (health !== "healthy") {
        throw reason(`container ${LOCAL_HOSTED_POSTGRES_CONTAINER} je ${health}`, "Spusť npm run dev:local-hosted.");
      }
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

    if (requestedInstanceId) {
      instanceResults = await verifyInstance(pool, requestedInstanceId);
    }
  } finally {
    await pool.end().catch(() => undefined);
  }

  for (const result of results) {
    console.log(`${result.label.padEnd(20, ".")} ${result.passed ? "PASS" : "FAIL"}`);
    if (!result.passed) {
      console.log(`Reason: ${result.message}`);
      console.log(`Fix: ${result.fix}`);
    }
  }
  if (requestedInstanceId) {
    console.log(`Instance ${requestedInstanceId}`);
    for (const result of instanceResults) {
      console.log(`${result.label.padEnd(24, ".")} ${result.outcome}`);
      if (result.message) console.log(`  ${result.message}`);
      if (result.failed && result.fix) console.log(`  Fix: ${result.fix}`);
    }
  }
  const passed = results.every((result) => result.passed)
    && instanceResults.every((result) => result.failed !== true);
  console.log(`Local Hosted ${".".repeat(7)} ${passed ? "READY" : "NOT READY"}`);
  if (!passed) process.exitCode = 1;
}

async function verifyInstance(pool, serverInstanceId) {
  let initial;
  try {
    initial = await readInstanceObservation(pool, serverInstanceId);
  } catch (error) {
    return unavailableInstanceResults(
      error instanceof Error ? error.message : String(error),
      "Zkontroluj instance tables a current migrace."
    );
  }
  if (!initial) {
    return unavailableInstanceResults(
      `server ${serverInstanceId} nebyl nalezen`,
      "Použij přesný serverInstanceId z admin control plane."
    );
  }

  const pollPolicy = resolveInstancePollPolicy(initial.canonicalTickRateMs);
  let latest = initial;
  let advancement = null;
  if (initial.status === RUNNING_STATUS) {
    const polling = await pollForInstanceAdvancement(pool, serverInstanceId, initial, pollPolicy);
    latest = polling.latest ?? initial;
    advancement = polling.advancement;
  }

  const results = [
    evaluateServerStatus(latest),
    evaluateInstanceWorkerHeartbeat(latest, pollPolicy),
    evaluateRuntimeLease(latest)
  ];

  if (initial.status === RUNNING_STATUS) {
    results.push({
      label: "Tick advancing",
      outcome: advancement?.tickAdvanced ? "PASS" : "FAIL",
      failed: advancement?.tickAdvanced !== true,
      message: formatTickTransition(initial, latest, advancement),
      fix: "Zkontroluj per-server worker ownership, scheduler a poslední instance error."
    });
    results.push({
      label: "State version",
      outcome: advancement?.stateVersionAdvanced ? "PASS" : "FAIL",
      failed: advancement?.stateVersionAdvanced !== true,
      message: `stateVersion ${formatCounter(initial.stateVersion)} -> ${formatCounter(latest.stateVersion)}`,
      fix: "Zkontroluj durable tick commit a recovery-head write."
    });
  } else {
    const message = `status=${initial.status}; tick advancement is only required for running instances`;
    results.push(unavailableResult("Tick advancing", message));
    results.push(unavailableResult("State version", message));
  }

  const recovery = evaluateRecoveryHead(latest);
  results.push({
    label: "Recovery head",
    outcome: recovery.outcome,
    failed: recovery.outcome === "FAIL",
    message: recovery.message,
    fix: "Zkontroluj empire_snapshot_latest a snapshot integrity."
  });

  const freshness = evaluateSnapshotFreshness({
    status: latest.status,
    snapshotCreatedAt: latest.snapshotCreatedAt,
    tickRateMs: pollPolicy.tickRateMs
  });
  results.push({
    label: "Snapshot freshness",
    outcome: freshness.outcome,
    failed: freshness.outcome === "FAIL",
    message: freshness.message,
    fix: "Zkontroluj worker tick loop a recovery-head persistence."
  });

  const activeSessionCount = latest.activeGameplaySessions ?? 0;
  const sessionMessage = activeSessionCount > 0
    ? `${activeSessionCount} active durable session(s) exist, but no validated raw session token is available to this verifier`
    : "no validated active gameplay session is available";
  results.push(unavailableResult(
    "Gameplay load/submit",
    `${sessionMessage}; authenticated load/submit was not attempted`
  ));
  return results;
}

async function pollForInstanceAdvancement(pool, serverInstanceId, initial, policy) {
  const startedAt = Date.now();
  let latest = initial;
  let advancement = evaluateInstanceAdvancement(initial, latest);
  while (Date.now() - startedAt < policy.timeoutMs) {
    const remainingMs = policy.timeoutMs - (Date.now() - startedAt);
    await sleep(Math.min(policy.pollIntervalMs, remainingMs));
    latest = await readInstanceObservation(pool, serverInstanceId);
    if (!latest || latest.status !== RUNNING_STATUS) break;
    advancement = evaluateInstanceAdvancement(initial, latest);
    if (advancement.tickAdvanced && advancement.stateVersionAdvanced) break;
  }
  return { latest, advancement };
}

async function readInstanceObservation(pool, serverInstanceId) {
  const result = await pool.query(
    `SELECT
       hosted.server_instance_id,
       hosted.status AS hosted_status,
       hosted.provisioning_state,
       hosted.mode,
       hosted.canonical_tick_rate_ms,
       hosted.current_snapshot_id,
       hosted.runtime_lease_owner_id,
       hosted.runtime_lease_incarnation_id,
       hosted.runtime_lease_expires_at,
       hosted.last_worker_heartbeat_at AS server_worker_heartbeat_at,
       hosted.last_error_code AS server_last_error_code,
       hosted.version AS server_version,
       runtime.status AS runtime_status,
       runtime.lock_version AS runtime_lock_version,
       runtime.updated_at AS runtime_updated_at,
       heartbeat.worker_id AS instance_worker_id,
       heartbeat.lease_expires_at AS instance_lease_expires_at,
       heartbeat.last_tick AS instance_tick,
       heartbeat.last_snapshot_at AS instance_last_snapshot_at,
       heartbeat.last_error_code AS instance_last_error_code,
       heartbeat.last_heartbeat_at AS instance_heartbeat_at,
       worker.status AS instance_worker_status,
       worker.worker_incarnation_id,
       worker.last_heartbeat_at AS worker_heartbeat_at,
       head.snapshot_id,
       head.tick AS snapshot_tick,
       head.root_version,
       head.payload ->> 'tick' AS payload_tick,
       head.payload #>> '{state,root,tick}' AS root_tick,
       head.payload #>> '{state,root,version}' AS state_version,
       head.payload #>> '{integrity,rootVersion}' AS integrity_root_version,
       head.payload #>> '{state,root,serverInstanceId}' AS snapshot_server_instance_id,
       head.created_at AS snapshot_created_at,
       head.updated_at AS snapshot_updated_at,
       (SELECT count(*)::int
        FROM empire_gameplay_sessions session
        WHERE session.server_instance_id=hosted.server_instance_id
          AND session.revoked_at IS NULL
          AND session.expires_at > clock_timestamp()) AS active_gameplay_sessions
     FROM empire_hosted_server_instances hosted
     LEFT JOIN empire_server_instances runtime
       ON runtime.server_instance_id=hosted.server_instance_id
     LEFT JOIN empire_hosted_instance_heartbeats heartbeat
       ON heartbeat.server_instance_id=hosted.server_instance_id
     LEFT JOIN empire_hosted_worker_heartbeats worker
       ON worker.worker_id=COALESCE(heartbeat.worker_id, hosted.runtime_lease_owner_id)
     LEFT JOIN empire_snapshot_latest head
       ON head.server_instance_id=hosted.server_instance_id
     WHERE hosted.server_instance_id=$1
     LIMIT 1`,
    [serverInstanceId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    serverInstanceId: String(row.server_instance_id),
    status: String(row.hosted_status),
    provisioningState: stringOrNull(row.provisioning_state),
    mode: stringOrNull(row.mode),
    canonicalTickRateMs: numberOrNull(row.canonical_tick_rate_ms),
    currentSnapshotId: stringOrNull(row.current_snapshot_id),
    runtimeLeaseOwnerId: stringOrNull(row.runtime_lease_owner_id),
    runtimeLeaseIncarnationId: stringOrNull(row.runtime_lease_incarnation_id),
    runtimeLeaseExpiresAt: dateOrNull(row.runtime_lease_expires_at),
    serverWorkerHeartbeatAt: dateOrNull(row.server_worker_heartbeat_at),
    serverLastErrorCode: stringOrNull(row.server_last_error_code),
    serverVersion: numberOrNull(row.server_version),
    runtimeStatus: stringOrNull(row.runtime_status),
    runtimeLockVersion: numberOrNull(row.runtime_lock_version),
    runtimeUpdatedAt: dateOrNull(row.runtime_updated_at),
    instanceWorkerId: stringOrNull(row.instance_worker_id),
    instanceLeaseExpiresAt: dateOrNull(row.instance_lease_expires_at),
    instanceTick: numberOrNull(row.instance_tick),
    instanceLastSnapshotAt: dateOrNull(row.instance_last_snapshot_at),
    instanceLastErrorCode: stringOrNull(row.instance_last_error_code),
    instanceHeartbeatAt: dateOrNull(row.instance_heartbeat_at),
    instanceWorkerStatus: stringOrNull(row.instance_worker_status),
    workerIncarnationId: stringOrNull(row.worker_incarnation_id),
    workerHeartbeatAt: dateOrNull(row.worker_heartbeat_at),
    snapshotId: stringOrNull(row.snapshot_id),
    snapshotTick: numberOrNull(row.snapshot_tick),
    rootVersion: numberOrNull(row.root_version),
    payloadTick: numberOrNull(row.payload_tick),
    rootTick: numberOrNull(row.root_tick),
    stateVersion: numberOrNull(row.state_version),
    integrityRootVersion: numberOrNull(row.integrity_root_version),
    snapshotServerInstanceId: stringOrNull(row.snapshot_server_instance_id),
    snapshotCreatedAt: dateOrNull(row.snapshot_created_at),
    snapshotUpdatedAt: dateOrNull(row.snapshot_updated_at),
    activeGameplaySessions: numberOrNull(row.active_gameplay_sessions)
  };
}

function evaluateServerStatus(observation) {
  const issues = [];
  if (observation.status === "failed" || observation.provisioningState === "failed") {
    issues.push(`status=${observation.status}; provisioning=${observation.provisioningState}`);
  }
  if (observation.status === RUNNING_STATUS && observation.provisioningState !== "ready") {
    issues.push(`running server has provisioning=${observation.provisioningState}`);
  }
  if (observation.status === RUNNING_STATUS && observation.runtimeStatus !== RUNNING_STATUS) {
    issues.push(`runtime row status=${observation.runtimeStatus ?? "missing"}`);
  }
  if (observation.status === RUNNING_STATUS && !observation.currentSnapshotId) {
    issues.push("current_snapshot_id is missing");
  }
  if (observation.serverLastErrorCode) issues.push(`lastError=${observation.serverLastErrorCode}`);
  return issues.length
    ? {
        label: "Server status",
        outcome: "FAIL",
        failed: true,
        message: issues.join("; "),
        fix: "Zkontroluj exact hosted/runtime server rows a poslední server error."
      }
    : {
        label: "Server status",
        outcome: observation.status.toUpperCase(),
        failed: false,
        message: `provisioning=${observation.provisioningState}; runtime=${observation.runtimeStatus ?? "missing"}; `
          + `serverVersion=${formatCounter(observation.serverVersion)}; runtimeLockVersion=${formatCounter(observation.runtimeLockVersion)}`
      };
}

function evaluateInstanceWorkerHeartbeat(observation, pollPolicy) {
  if (observation.status !== RUNNING_STATUS) {
    return unavailableResult(
      "Worker heartbeat",
      `status=${observation.status}; a fresh instance heartbeat is not required`
    );
  }
  const issues = [];
  const nowMs = Date.now();
  if (!observation.instanceWorkerId) issues.push("instance heartbeat is missing");
  if (observation.instanceWorkerId !== observation.runtimeLeaseOwnerId) issues.push("instance worker does not own runtime lease");
  if (observation.instanceWorkerStatus !== "online") issues.push(`worker status=${observation.instanceWorkerStatus ?? "missing"}`);
  if (observation.instanceLastErrorCode) issues.push(`instance error=${observation.instanceLastErrorCode}`);
  if (ageMs(observation.instanceHeartbeatAt, nowMs) > pollPolicy.timeoutMs) issues.push("instance heartbeat is stale");
  if (ageMs(observation.workerHeartbeatAt, nowMs) > pollPolicy.timeoutMs) issues.push("worker heartbeat is stale");
  return issues.length
    ? {
        label: "Worker heartbeat",
        outcome: "FAIL",
        failed: true,
        message: issues.join("; "),
        fix: "Zkontroluj per-server heartbeat, worker log a runtime ownership."
      }
    : {
        label: "Worker heartbeat",
        outcome: "PASS",
        failed: false,
        message: `worker=${observation.instanceWorkerId}; lastTick=${formatCounter(observation.instanceTick)}`
      };
}

function evaluateRuntimeLease(observation) {
  if (observation.status !== RUNNING_STATUS) {
    return unavailableResult(
      "Runtime lease",
      `status=${observation.status}; an active runtime lease is not required`
    );
  }
  const issues = [];
  const nowMs = Date.now();
  if (!observation.runtimeLeaseOwnerId) issues.push("lease owner is missing");
  if (observation.runtimeLeaseOwnerId !== observation.instanceWorkerId) issues.push("lease owner/instance worker mismatch");
  if (observation.runtimeLeaseIncarnationId !== observation.workerIncarnationId) issues.push("worker incarnation mismatch");
  if (dateMs(observation.runtimeLeaseExpiresAt) <= nowMs) issues.push("server runtime lease is expired");
  if (dateMs(observation.instanceLeaseExpiresAt) <= nowMs) issues.push("instance heartbeat lease is expired");
  return issues.length
    ? {
        label: "Runtime lease",
        outcome: "FAIL",
        failed: true,
        message: issues.join("; "),
        fix: "Zkontroluj runtime lease owner, incarnation a worker fencing."
      }
    : {
        label: "Runtime lease",
        outcome: "PASS",
        failed: false,
        message: `owner=${observation.runtimeLeaseOwnerId}; expires=${observation.runtimeLeaseExpiresAt}`
      };
}

function unavailableInstanceResults(message, fix) {
  return INSTANCE_RESULT_LABELS.map((label, index) => index === 0
    ? { label, outcome: "FAIL", failed: true, message, fix }
    : unavailableResult(label, "server observation is unavailable"));
}

function unavailableResult(label, message) {
  return { label, outcome: "NOT AVAILABLE", failed: false, message };
}

function formatTickTransition(before, after, advancement) {
  const transition = [
    `heartbeat ${formatCounter(before.instanceTick)} -> ${formatCounter(after.instanceTick)}`,
    `snapshot ${formatCounter(before.snapshotTick)} -> ${formatCounter(after.snapshotTick)}`,
    `root ${formatCounter(before.rootTick)} -> ${formatCounter(after.rootTick)}`
  ].join("; ");
  const missing = advancement?.missingTickFields?.length
    ? `; missing=${advancement.missingTickFields.join(",")}`
    : "";
  const stalled = advancement?.stalledTickFields?.length
    ? `; stalled=${advancement.stalledTickFields.join(",")}`
    : "";
  return `${transition}${missing}${stalled}`;
}

function compareCounters(mismatches, label, left, right) {
  if (!isCounter(left) || !isCounter(right) || left !== right) mismatches.push(label);
}

function isCounter(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function stringOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function dateOrNull(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function dateMs(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function ageMs(value, nowMs) {
  const timestamp = dateMs(value);
  return Number.isFinite(timestamp) ? Math.max(0, nowMs - timestamp) : Number.POSITIVE_INFINITY;
}

function formatCounter(value) {
  return isCounter(value) ? String(value) : "missing";
}

function sleep(durationMs) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, Math.max(0, durationMs)));
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

const invokedAsScript = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) await main();
