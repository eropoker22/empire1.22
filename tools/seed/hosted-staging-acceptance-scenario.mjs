import { createHash } from "node:crypto";
import { createPostgresHostedControlPlaneRepository } from "../../apps/server/src/admin/hosted";
import {
  createPostgresDatabase,
  createPostgresSnapshotRepository
} from "../../apps/server/src/runtime/persistence/postgres";
import {
  assertRemoteStagingFixtureServer,
  assertSafeRemoteStagingFixtureEnvironment
} from "../../scripts/remote-staging-fixture-safety.mjs";
import {
  applyHostedE2eScenario,
  HOSTED_E2E_SCENARIOS,
  isHostedE2eScenario
} from "./hosted-e2e-scenarios";

const safety = assertSafeRemoteStagingFixtureEnvironment(process.env);
const serverInstanceId = readArgument("--server");
const scenarioName = readArgument("--scenario");
if (!serverInstanceId) throw new Error("REMOTE_STAGING_FIXTURE_SERVER_REQUIRED");
if (!isHostedE2eScenario(scenarioName)) {
  throw new Error(`Remote staging scenario must be one of: ${HOSTED_E2E_SCENARIOS.join(", ")}.`);
}

const database = createPostgresDatabase(String(process.env.EMPIRE_DATABASE_URL), {
  max: 1,
  connectionTimeoutMillis: 10_000,
  queryTimeoutMillis: 30_000
});
try {
  const controlPlane = createPostgresHostedControlPlaneRepository(database);
  const server = await controlPlane.getServer(serverInstanceId);
  assertRemoteStagingFixtureServer(server);
  const snapshots = createPostgresSnapshotRepository(database);
  const current = await snapshots.loadRecoveryHead(serverInstanceId);
  if (!current) throw new Error("REMOTE_STAGING_FIXTURE_RECOVERY_HEAD_MISSING");
  const seeded = applyHostedE2eScenario(current, scenarioName, new Date().toISOString());
  const result = await snapshots.saveRecoveryHead(seeded);
  if (!["created", "updated"].includes(result)) {
    throw new Error("REMOTE_STAGING_FIXTURE_RECOVERY_HEAD_CONFLICT");
  }
  console.log(JSON.stringify({
    environment: safety.environment,
    scenario: scenarioName,
    serverInstanceHash: safeHash(serverInstanceId),
    stateVersion: seeded.integrity.rootVersion,
    targetHashPrefix: safety.targetHash.slice(0, 16),
    tick: seeded.tick
  }));
} finally {
  await database.close();
}

function readArgument(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
}

function safeHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}
