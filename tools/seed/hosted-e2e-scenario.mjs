import "../../scripts/load-local-environment";
import { createPostgresHostedControlPlaneRepository } from "../../apps/server/src/admin/hosted";
import {
  createPostgresDatabase,
  createPostgresSnapshotRepository
} from "../../apps/server/src/runtime/persistence/postgres";
import { assertSafeHostedE2eFixtureEnvironment } from "../../scripts/local-hosted/database-safety.mjs";
import {
  applyHostedE2eScenario,
  HOSTED_E2E_SCENARIOS,
  isHostedE2eScenario
} from "./hosted-e2e-scenarios";

const databaseUrl = String(process.env.EMPIRE_DATABASE_URL || "").trim();
const fixtureEnvironment = assertSafeHostedE2eFixtureEnvironment({
  databaseUrl,
  fixturesEnabled: process.env.EMPIRE_HOSTED_E2E_FIXTURES,
  nodeEnv: process.env.NODE_ENV
});
const serverInstanceId = readArgument("--server");
const scenarioName = readArgument("--scenario");
if (!serverInstanceId) throw new Error("Hosted E2E scenario requires --server.");
if (!isHostedE2eScenario(scenarioName)) {
  throw new Error(`Hosted E2E scenario must be one of: ${HOSTED_E2E_SCENARIOS.join(", ")}.`);
}

const database = createPostgresDatabase(databaseUrl, {
  max: 1,
  connectionTimeoutMillis: 5_000,
  statementTimeoutMillis: 30_000
});
try {
  logSeedCheckpoint("load-server:start");
  const controlPlane = createPostgresHostedControlPlaneRepository(database);
  const server = await controlPlane.getServer(serverInstanceId);
  logSeedCheckpoint("load-server:done");
  if (!server || server.provisioningState !== "ready" || server.status !== "lobby") {
    throw new Error("Hosted E2E scenarios can seed only a ready lobby server.");
  }
  const snapshots = createPostgresSnapshotRepository(database);
  logSeedCheckpoint("load-recovery-head:start");
  const current = await snapshots.loadRecoveryHead(serverInstanceId);
  logSeedCheckpoint("load-recovery-head:done");
  if (!current) throw new Error("Hosted E2E scenario recovery head is missing.");
  logSeedCheckpoint("apply-scenario:start");
  const seeded = applyHostedE2eScenario(current, scenarioName, new Date().toISOString());
  logSeedCheckpoint("apply-scenario:done");
  logSeedCheckpoint("save-recovery-head:start");
  const result = await snapshots.saveRecoveryHead(seeded);
  logSeedCheckpoint("save-recovery-head:done");
  console.log(JSON.stringify({
    database: fixtureEnvironment.databaseName,
    result,
    scenario: scenarioName,
    serverInstanceId,
    stateVersion: seeded.integrity.rootVersion,
    tick: seeded.tick
  }));
} finally {
  logSeedCheckpoint("database-close:start");
  await database.close();
  logSeedCheckpoint("database-close:done");
}

function logSeedCheckpoint(step) {
  console.error(`[hosted-e2e-scenario] step=${step}`);
}

function readArgument(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
}
