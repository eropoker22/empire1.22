import "../../../../scripts/load-local-environment";
import * as http from "node:http";
import {
  createHostedRuntimeWorker,
  createPostgresHostedControlPlaneRepository,
  createPostgresHostedRuntimeMutationCommitter,
  HOSTED_WORKER_FRESH_MS
} from "../admin/hosted";
import { createServerApp } from "../app/server-app";
import {
  createPostgresDatabase,
  createPostgresRuntimePersistenceRepositories
} from "../runtime/persistence/postgres";
import { createPostgresPlayerEntryRepository } from "../player-entry/postgres-player-entry-repository";
import { createHostedRuntimeWorkerRunLoop, shutdownHostedRuntimeWorker } from "./hosted-runtime-worker-run-loop";
import { assertHostedRuntimeWorkerSchemaCurrent } from "./hosted-runtime-worker-preflight";
import { resolveHostedRuntimeWorkerEnvironment } from "./hosted-runtime-worker-environment";
import { writeHostedWorkerDiagnostic } from "./hosted-worker-diagnostic";
import { assertSupportedNodeVersion } from "../../../../scripts/supported-node-policy.mjs";

const nodeRuntime = assertSupportedNodeVersion(process.versions.node);
const workerEnvironment = resolveHostedRuntimeWorkerEnvironment(process.env);
const { databaseUrl, workerId, region, buildSha, port, releaseEnvironment } = workerEnvironment;

const database = createPostgresDatabase(databaseUrl, {
  max: 4,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  statementTimeoutMillis: 30_000
});
const controlPlane = createPostgresHostedControlPlaneRepository(database);
const playerEntry = createPostgresPlayerEntryRepository(database);
const workerSchema = await assertHostedRuntimeWorkerSchemaCurrent(database).catch(async (error) => {
  await database.close();
  throw error;
});

const persistence = createPostgresRuntimePersistenceRepositories({
  databaseUrl,
  database,
  tickLockOwnerId: workerId,
  snapshotRetentionPolicy: {
    rollingCheckpointCountActive: positiveIntegerEnvironment(
      "EMPIRE_SNAPSHOT_ROLLING_ACTIVE",
      24
    ),
    rollingCheckpointCountTerminal: positiveIntegerEnvironment(
      "EMPIRE_SNAPSHOT_ROLLING_TERMINAL",
      5
    ),
    retainLifecycleCheckpoints: booleanEnvironment(
      "EMPIRE_SNAPSHOT_RETAIN_LIFECYCLE",
      true
    ),
    terminalRetentionDays: positiveIntegerEnvironment(
      "EMPIRE_SNAPSHOT_TERMINAL_RETENTION_DAYS",
      30
    ),
    cleanupBatchSize: positiveIntegerEnvironment(
      "EMPIRE_SNAPSHOT_CLEANUP_BATCH_SIZE",
      250
    )
  },
  snapshotMaintenanceIntervalMs: positiveIntegerEnvironment(
    "EMPIRE_SNAPSHOT_MAINTENANCE_INTERVAL_MS",
    15 * 60 * 1000
  )
});
const server = createServerApp({ persistence, database, environment: { ...process.env, NODE_ENV: "production" } });
if (!server.gameplaySessionService.productionReady) {
  throw new Error("Hosted worker refuses to start without a production-ready gameplay session repository.");
}
const runtimeMutationCommitter = createPostgresHostedRuntimeMutationCommitter(
  database,
  persistence.snapshotMetrics
);
const worker = createHostedRuntimeWorker({ workerId, region, buildSha,
  controlPlane, server, playerEntry, runtimeMutationCommitter });
let healthy = true;
let shuttingDown = false;
let lastErrorCode: string | null = null;

await worker.heartbeat();
await worker.restoreKnownInstances();
writeHostedWorkerDiagnostic({
  level: "info", event: "worker_started", buildSha, workerId,
  environment: releaseEnvironment, region, schemaVersion: workerSchema.schemaVersion
});

const runLoop = createHostedRuntimeWorkerRunLoop({
  requestDrain: worker.requestDrain,
  runOnce: async () => {
    if (shuttingDown) return;
    try { await worker.runOnce(); healthy = true; lastErrorCode = null; }
    catch (error) {
      healthy = false;
      lastErrorCode = safeErrorCode(error);
      writeHostedWorkerDiagnostic({
        level: "error", event: "worker_run_failed", errorCode: lastErrorCode,
        buildSha, workerId, environment: releaseEnvironment, region,
        schemaVersion: workerSchema.schemaVersion
      });
      await worker.heartbeat("failed").catch(() => undefined);
    }
  }
});
runLoop.start();

const healthServer = http.createServer(async (request, response) => {
  if (request.url !== "/health") { response.writeHead(404).end(); return; }
  try {
    const checkedAt = new Date();
    const heartbeat = await controlPlane.getFreshWorkerHeartbeat(
      new Date(checkedAt.getTime() - HOSTED_WORKER_FRESH_MS).toISOString()
    );
    const heartbeatCurrent = heartbeat?.workerId === workerId
      && heartbeat.buildSha === buildSha
      && heartbeat.status === "online";
    const available = healthy && !shuttingDown && heartbeatCurrent;
    response.writeHead(available ? 200 : 503, {
      "content-type": "application/json",
      "cache-control": "no-store"
    });
    response.end(JSON.stringify({
      status: available ? "ok" : "unavailable",
      database: "available",
      lastErrorCode,
      buildSha,
      workerId,
      environment: releaseEnvironment,
      region,
      schemaVersion: workerSchema.schemaVersion,
      expectedSchemaVersion: workerSchema.expectedSchemaVersion,
      heartbeat: {
        registered: heartbeatCurrent,
        lastAt: heartbeat?.lastHeartbeatAt ?? null,
        ageMs: heartbeat ? Math.max(0, checkedAt.getTime() - Date.parse(heartbeat.lastHeartbeatAt)) : null
      },
      runtime: {
        nodeVersion: nodeRuntime.detectedVersion,
        nodeMajor: nodeRuntime.detectedMajor
      },
      snapshotPersistence: {
        maintenance: persistence.snapshotMaintenance.getHealth(),
        metrics: persistence.snapshotRepository.getMetrics()
      }
    }));
  } catch (_error) {
    response.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({
      status: "unavailable",
      database: "unavailable",
      lastErrorCode: lastErrorCode ?? "WORKER_HEALTH_DATABASE_UNAVAILABLE",
      buildSha,
      workerId,
      environment: releaseEnvironment,
      region,
      schemaVersion: workerSchema.schemaVersion,
      expectedSchemaVersion: workerSchema.expectedSchemaVersion,
      heartbeat: { registered: false, lastAt: null, ageMs: null },
      runtime: {
        nodeVersion: nodeRuntime.detectedVersion,
        nodeMajor: nodeRuntime.detectedMajor
      }
    }));
  }
});
healthServer.listen(port, "0.0.0.0");

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  writeHostedWorkerDiagnostic({
    level: "info", event: "worker_shutdown_started", buildSha, workerId,
    environment: releaseEnvironment, region, schemaVersion: workerSchema.schemaVersion
  });
  await shutdownHostedRuntimeWorker({
    drain: runLoop.drain,
    closeHealthServer: () => new Promise<void>((resolve) => healthServer.close(() => resolve())),
    stopWorker: worker.stop,
    closePersistence: persistence.close
  });
  writeHostedWorkerDiagnostic({
    level: "info", event: "worker_stopped", buildSha, workerId,
    environment: releaseEnvironment, region, schemaVersion: workerSchema.schemaVersion
  });
  process.exit(0);
};
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());

const safeErrorCode = (error: unknown): string => {
  if (typeof error !== "object" || error === null) return "HOSTED_WORKER_OPERATION_FAILED";
  const candidate = "safeCode" in error ? error.safeCode : "code" in error ? error.code : null;
  const code = String(candidate ?? "").trim();
  return /^[A-Z0-9_:-]{1,80}$/u.test(code) ? code : "HOSTED_WORKER_OPERATION_FAILED";
};

function positiveIntegerEnvironment(key: string, fallback: number): number {
  const value = Number(process.env[key] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function booleanEnvironment(key: string, fallback: boolean): boolean {
  const value = String(process.env[key] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}
