import "../../../../scripts/load-local-environment";
import * as http from "node:http";
import {
  createHostedRuntimeWorker,
  createPostgresHostedControlPlaneRepository,
  createPostgresHostedRuntimeMutationCommitter
} from "../admin/hosted";
import { createServerApp } from "../app/server-app";
import {
  createPostgresDatabase,
  createPostgresRuntimePersistenceRepositories
} from "../runtime/persistence/postgres";
import { createPostgresPlayerEntryRepository } from "../player-entry/postgres-player-entry-repository";
import { createHostedRuntimeWorkerRunLoop, shutdownHostedRuntimeWorker } from "./hosted-runtime-worker-run-loop";
import { assertHostedRuntimeWorkerSchemaCurrent } from "./hosted-runtime-worker-preflight";

const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? "").trim();
const workerId = String(process.env.EMPIRE_HOSTED_WORKER_ID ?? "").trim();
const region = String(process.env.EMPIRE_HOSTED_WORKER_REGION ?? "eu-central").trim();
const buildSha = String(process.env.EMPIRE_BUILD_SHA ?? "local").trim();
const port = Number(process.env.PORT ?? 8080);
if (!databaseUrl || !workerId) throw new Error("Hosted worker requires EMPIRE_DATABASE_URL and EMPIRE_HOSTED_WORKER_ID.");
if (process.env.NODE_ENV === "production" && !/^[0-9a-f]{40}$/u.test(buildSha)) {
  throw new Error("Production hosted worker requires an exact 40-character EMPIRE_BUILD_SHA.");
}
if (String(process.env.EMPIRE_PERSISTENCE_DRIVER ?? "").trim().toLowerCase() !== "postgres" ||
  String(process.env.GAMEPLAY_PERSISTENCE_DRIVER ?? "").trim().toLowerCase() !== "postgres") {
  throw new Error("Hosted worker requires PostgreSQL runtime and gameplay persistence drivers.");
}
const gameplaySessionSecret = String(process.env.GAMEPLAY_SLICE_SESSION_SECRET ?? "").trim();
const snapshotSecret = String(process.env.GAMEPLAY_SLICE_SNAPSHOT_SECRET ?? "").trim();
if (gameplaySessionSecret.length < 32 || snapshotSecret.length < 32 || gameplaySessionSecret === snapshotSecret) {
  throw new Error("Hosted worker requires distinct gameplay session and snapshot secrets of at least 32 characters.");
}

const database = createPostgresDatabase(databaseUrl, {
  max: 4,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  statementTimeoutMillis: 30_000
});
const controlPlane = createPostgresHostedControlPlaneRepository(database);
const playerEntry = createPostgresPlayerEntryRepository(database);
try {
  await assertHostedRuntimeWorkerSchemaCurrent(database);
} catch (error) {
  await database.close();
  throw error;
}

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

const runLoop = createHostedRuntimeWorkerRunLoop({
  requestDrain: worker.requestDrain,
  runOnce: async () => {
    if (shuttingDown) return;
    try { await worker.runOnce(); healthy = true; lastErrorCode = null; }
    catch (error) {
      healthy = false;
      lastErrorCode = safeErrorCode(error);
      await worker.heartbeat("failed").catch(() => undefined);
    }
  }
});
runLoop.start();

const healthServer = http.createServer((request, response) => {
  if (request.url !== "/health") { response.writeHead(404).end(); return; }
  response.writeHead(healthy && !shuttingDown ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify({
    status: healthy && !shuttingDown ? "ok" : "unavailable",
    lastErrorCode,
    snapshotPersistence: {
      maintenance: persistence.snapshotMaintenance.getHealth(),
      metrics: persistence.snapshotRepository.getMetrics()
    }
  }));
});
healthServer.listen(port, "0.0.0.0");

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await shutdownHostedRuntimeWorker({
    drain: runLoop.drain,
    closeHealthServer: () => new Promise<void>((resolve) => healthServer.close(() => resolve())),
    stopWorker: worker.stop,
    closePersistence: persistence.close
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
