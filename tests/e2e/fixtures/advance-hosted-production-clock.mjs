import { runTick } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createPostgresDatabase } from "../../../apps/server/src/runtime/persistence/postgres/postgres-client";
import { createPostgresSnapshotRepositoryForTransaction } from "../../../apps/server/src/runtime/persistence/postgres/postgres-snapshot-repository";
import { lockPostgresServerInstanceRow } from "../../../apps/server/src/runtime/persistence/postgres/postgres-atomic-command-transaction";
import { createPostgresHostedControlPlaneRepository } from "../../../apps/server/src/admin/hosted";
import { assertSafeHostedE2eFixtureEnvironment } from "../../../scripts/local-hosted/database-safety.mjs";

// Node-only test clock, never reachable from the application or an HTTP endpoint.
// Serializes with real commands and the worker; all production, reservations and
// income still go through every canonical tick. No quantities/deadlines are seeded.
const databaseUrl = String(process.env.EMPIRE_TEST_DATABASE_URL ?? "");
assertSafeHostedE2eFixtureEnvironment({ databaseUrl, fixturesEnabled: process.env.EMPIRE_LOCAL_HOSTED_CONTROLLED_PRODUCTION_CLOCK, nodeEnv: process.env.NODE_ENV });
const [instanceId, dueValue, buildingId, playerId] = process.argv.slice(2);
if (!instanceId || instanceId !== process.env.EMPIRE_UI_PARITY_SERVER_ID) throw new Error("TEST_CLOCK_INSTANCE_BINDING_REQUIRED");
const dueTick = Number(dueValue);
const database = createPostgresDatabase(databaseUrl, { max: 2, statementTimeoutMillis: 30000 });
try {
  const server = await createPostgresHostedControlPlaneRepository(database).getServer(instanceId);
  if (!server?.displayName.startsWith("Local Hosted ") || server.status !== "running"
    || Date.now() - Date.parse(server.createdAt) > 2 * 60 * 60 * 1000) throw new Error("TEST_CLOCK_REQUIRES_FRESH_DISPOSABLE_SERVER");
  const result = await database.transaction(async client => {
    await lockPostgresServerInstanceRow(client, instanceId);
    const snapshots = createPostgresSnapshotRepositoryForTransaction(client);
    const snapshot = await snapshots.loadRecoveryHead(instanceId);
    if (!snapshot || snapshot.state.matchResult) throw new Error("TEST_CLOCK_SNAPSHOT_UNAVAILABLE");
    const building = snapshot.state.buildingsById[buildingId];
    if (building?.ownerPlayerId !== playerId || !Object.values(building.productionLines ?? {}).some(line => line.queuedAmount > 0)) throw new Error("TEST_CLOCK_REQUIRES_OWNED_RUNNING_PRODUCTION");
    const beforeTick = snapshot.tick;
    if (!Number.isSafeInteger(dueTick) || dueTick < beforeTick || dueTick - beforeTick > 120) throw new Error("TEST_CLOCK_ADVANCE_OUT_OF_BOUNDS");
    const config = resolveModeConfig(snapshot.mode);
    // Match the worker's bounded catch-up semantics: logical work advances while
    // the calendar is observed at the controlled current instant.
    const at = new Date();
    while (snapshot.state.root.tick < dueTick) {
      const previousTick = snapshot.state.root.tick;
      snapshot.state = runTick(snapshot.state,
        { config, clock: { now: () => at, nowIso: () => at.toISOString() }, calendarNow: at.toISOString() }).nextState;
      if (snapshot.state.root.tick <= previousTick) throw new Error("TEST_CLOCK_TICK_DID_NOT_ADVANCE");
      snapshot.state.root.version += 1;
    }
    snapshot.tick = snapshot.state.root.tick;
    snapshot.integrity.rootVersion = snapshot.state.root.version;
    snapshot.integrity.entityCounts = { players: Object.keys(snapshot.state.playersById).length, alliances: Object.keys(snapshot.state.alliancesById).length,
      districts: Object.keys(snapshot.state.districtsById).length, buildings: Object.keys(snapshot.state.buildingsById).length };
    snapshot.runtime.commandRateLimitWindow = { tick: snapshot.tick, commandCountsByPlayerId: {} };
    snapshot.snapshotId = `snapshot:${instanceId}:${snapshot.tick}:${snapshot.state.root.version}`;
    snapshot.createdAt = at.toISOString();
    await snapshots.saveRecoveryHead(snapshot);
    return { beforeTick, afterTick: snapshot.tick, rootVersion: snapshot.state.root.version, source: "canonical-runTick-under-postgres-command-lock" };
  });
  console.log(JSON.stringify(result));
} finally { await database.close(); }
