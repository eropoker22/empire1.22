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
  const controlPlane = createPostgresHostedControlPlaneRepository(database);
  const server = await controlPlane.getServer(serverInstanceId);
  if (!server || server.provisioningState !== "ready" || server.status !== "lobby") {
    throw new Error("Hosted E2E scenarios can seed only a ready lobby server.");
  }
  const snapshots = createPostgresSnapshotRepository(database);
  const current = await snapshots.loadRecoveryHead(serverInstanceId);
  if (!current) throw new Error("Hosted E2E scenario recovery head is missing.");
  const seeded = applyHostedE2eScenario(current, scenarioName, new Date().toISOString());
  const result = await snapshots.saveRecoveryHead(seeded);
  console.log(JSON.stringify({
    database: fixtureEnvironment.databaseName,
    result,
    scenario: scenarioName,
    serverInstanceId,
    stateVersion: seeded.integrity.rootVersion,
    tick: seeded.tick
  }));
} finally {
  await database.close();
}

function readArgument(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
}
