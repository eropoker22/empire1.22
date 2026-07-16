import "../../../../scripts/load-local-environment";
import * as http from "node:http";
import { createHostedRuntimeWorker, createPostgresHostedControlPlaneRepository } from "../admin/hosted";
import { createServerApp } from "../app/server-app";
import { createPostgresDatabase, createPostgresRuntimePersistenceRepositories } from "../runtime/persistence/postgres";

const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? "").trim();
const workerId = String(process.env.EMPIRE_HOSTED_WORKER_ID ?? "").trim();
const region = String(process.env.EMPIRE_HOSTED_WORKER_REGION ?? "eu-central").trim();
const buildSha = String(process.env.EMPIRE_BUILD_SHA ?? "local").trim();
const port = Number(process.env.PORT ?? 8080);
if (!databaseUrl || !workerId) throw new Error("Hosted worker requires EMPIRE_DATABASE_URL and EMPIRE_HOSTED_WORKER_ID.");

const database = createPostgresDatabase(databaseUrl);
const controlPlane = createPostgresHostedControlPlaneRepository(database);
if (!await controlPlane.isSchemaCurrent()) throw new Error("Hosted worker refuses to start with pending database migrations.");

const persistence = createPostgresRuntimePersistenceRepositories({ databaseUrl, database, tickLockOwnerId: workerId });
const server = createServerApp({ persistence, environment: { ...process.env, NODE_ENV: "production" } });
const worker = createHostedRuntimeWorker({ workerId, region, buildSha,
  controlPlane, server });
let healthy = true;
let running = false;
let shuttingDown = false;

await worker.heartbeat();
await worker.restoreKnownInstances();

const run = async () => {
  if (running || shuttingDown) return;
  running = true;
  try { await worker.runOnce(); healthy = true; }
  catch (_error) { healthy = false; }
  finally { running = false; }
};
const timer = setInterval(() => void run(), 5_000);
void run();

const healthServer = http.createServer((request, response) => {
  if (request.url !== "/health") { response.writeHead(404).end(); return; }
  response.writeHead(healthy && !shuttingDown ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: healthy && !shuttingDown ? "ok" : "unavailable" }));
});
healthServer.listen(port, "0.0.0.0");

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  await new Promise<void>((resolve) => healthServer.close(() => resolve()));
  await worker.stop();
  await persistence.close();
  process.exit(0);
};
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
