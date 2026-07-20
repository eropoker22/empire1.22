import "../../../../scripts/load-local-environment";
import * as http from "node:http";
import { createHostedRuntimeWorker, createPostgresHostedControlPlaneRepository } from "../admin/hosted";
import { createServerApp } from "../app/server-app";
import {
  createPostgresDatabase,
  createPostgresRuntimePersistenceRepositories,
  isProductionSchemaCurrent
} from "../runtime/persistence/postgres";
import { createPostgresPlayerEntryRepository } from "../player-entry/postgres-player-entry-repository";
import { createHostedRuntimeWorkerRunLoop, shutdownHostedRuntimeWorker } from "./hosted-runtime-worker-run-loop";

const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? "").trim();
const workerId = String(process.env.EMPIRE_HOSTED_WORKER_ID ?? "").trim();
const region = String(process.env.EMPIRE_HOSTED_WORKER_REGION ?? "eu-central").trim();
const buildSha = String(process.env.EMPIRE_BUILD_SHA ?? "local").trim();
const port = Number(process.env.PORT ?? 8080);
if (!databaseUrl || !workerId) throw new Error("Hosted worker requires EMPIRE_DATABASE_URL and EMPIRE_HOSTED_WORKER_ID.");
if (String(process.env.EMPIRE_PERSISTENCE_DRIVER ?? "").trim().toLowerCase() !== "postgres" ||
  String(process.env.GAMEPLAY_PERSISTENCE_DRIVER ?? "").trim().toLowerCase() !== "postgres") {
  throw new Error("Hosted worker requires PostgreSQL runtime and gameplay persistence drivers.");
}
const gameplaySessionSecret = String(process.env.GAMEPLAY_SLICE_SESSION_SECRET ?? "").trim();
const snapshotSecret = String(process.env.GAMEPLAY_SLICE_SNAPSHOT_SECRET ?? "").trim();
if (gameplaySessionSecret.length < 32 || snapshotSecret.length < 32 || gameplaySessionSecret === snapshotSecret) {
  throw new Error("Hosted worker requires distinct gameplay session and snapshot secrets of at least 32 characters.");
}

const database = createPostgresDatabase(databaseUrl);
const controlPlane = createPostgresHostedControlPlaneRepository(database);
const playerEntry = createPostgresPlayerEntryRepository(database);
if (!await isProductionSchemaCurrent(database)) {
  throw new Error("Hosted worker refuses to start with pending or mismatched database migrations.");
}

const persistence = createPostgresRuntimePersistenceRepositories({ databaseUrl, database, tickLockOwnerId: workerId });
const server = createServerApp({ persistence, database, environment: { ...process.env, NODE_ENV: "production" } });
if (!server.gameplaySessionService.productionReady) {
  throw new Error("Hosted worker refuses to start without a production-ready gameplay session repository.");
}
const worker = createHostedRuntimeWorker({ workerId, region, buildSha,
  controlPlane, server, playerEntry });
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
  response.end(JSON.stringify({ status: healthy && !shuttingDown ? "ok" : "unavailable", lastErrorCode }));
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
