import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import { sharedCitySpawnDistrictIds, enabledSharedCitySpawnDistrictIds } from
  "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import { createInstanceSnapshot } from "../../apps/server/src/runtime";
import type { AtomicCommandCrashPoint } from
  "../../apps/server/src/runtime/instance-manager/atomic-command-dispatcher";
import type { AtomicCommandTransactionBoundary } from
  "../../apps/server/src/runtime/instance-manager/atomic-command-transaction";
import {
  createPostgresRuntimePersistenceRepositories,
  type PostgresDatabase
} from "../../apps/server/src/runtime/persistence/postgres";
import { createSelectSpawnDistrictCommandFixture } from "../fixtures/command-fixtures";
import { createIsolatedPostgresTestSchema } from "./helpers/isolated-postgres-test-schema";
import { resolveLivePostgresSmokeConfig } from "./helpers/postgres-prod-like-smoke-helpers";
import type { BuyPlayerMarketListingCommand, CreatePlayerMarketListingCommand } from "@empire/shared-types";
import type { ServerMarketState } from "../../packages/game-core/src/rules/market/market-types";

const live = resolveLivePostgresSmokeConfig();
const run = live.run ? it : it.skip;

const commandCrashPoints: AtomicCommandCrashPoint[] = [
  "afterReserve",
  "afterCommandLog",
  "afterApplyBeforeSnapshot",
  "afterSnapshotBeforeMarkApplied",
  "afterMarkAppliedBeforeCommit"
];

describe("PostgreSQL atomic rollback live", () => {
  run("serializes two independent buyers of one listing and replays without a second payment", async () => {
    const isolated = await createIsolatedPostgresTestSchema(live.databaseUrl!, "market_two_buyers");
    const persistence = createPostgresRuntimePersistenceRepositories({ databaseUrl: isolated.databaseUrl, database: isolated.database });
    const server = createServerApp({ persistence });
    const secondServer = createServerApp({ persistence });
    try {
      const fixture = await createRuntimeFixture(server, "market-race");
      expect((await server.instanceManager.dispatchCommand(fixture.instanceId, fixture.command))?.errors).toEqual([]);
      const sellerId = fixture.command.playerId;
      const buyers = ["buyer:a", "buyer:b"];
      for (const [index, playerId] of buyers.entries()) {
        const districtId = enabledSharedCitySpawnDistrictIds.filter(id => id !== fixture.command.payload.districtId)[index];
        expect((await ensureGameplaySliceSessionResult(server.instanceManager, { serverInstanceId: fixture.instanceId, playerId, districtId })).accepted).toBe(true);
        expect((await server.instanceManager.dispatchCommand(fixture.instanceId, createSelectSpawnDistrictCommandFixture({
          id: `spawn:${playerId}`, serverInstanceId: fixture.instanceId, playerId, payload: { districtId }
        })))?.errors).toEqual([]);
      }
      // Initial fixture inventory only. All listing reservations, purchases and replays use the real dispatcher.
      const sellerResource = fixture.runtime.state.resourceStatesById[fixture.runtime.state.playersById[sellerId].resourceStateId];
      sellerResource.balances.chemicals = 10;
      fixture.runtime.state.root.version += 1;
      await persistence.snapshotRepository.saveRecoveryHead(createInstanceSnapshot(fixture.runtime));
      const ids = [sellerId, ...buyers];
      const totals = (state: typeof fixture.runtime.state) => ids.reduce((sum, id) => {
        const balances = state.resourceStatesById[state.playersById[id].resourceStateId].balances;
        return { cash: sum.cash + (balances.cash ?? 0), chemicals: sum.chemicals + (balances.chemicals ?? 0) };
      }, { cash: 0, chemicals: 0 });
      const before = totals(fixture.runtime.state);
      const listing: CreatePlayerMarketListingCommand = { ...fixture.command, id: "market:create", type: "create-player-market-listing",
        payload: { resourceId: "chemicals", amount: 5, unitPrice: 10, paymentType: "cleanCash" } };
      expect((await server.instanceManager.dispatchCommand(fixture.instanceId, listing))?.errors).toEqual([]);
      const listingId = (fixture.runtime.state.market as unknown as ServerMarketState).playerListings[0].id;
      secondServer.instanceManager.createInstance(fixture.instanceId, "free");
      await secondServer.instanceManager.restoreInstance(fixture.instanceId);
      const commands: BuyPlayerMarketListingCommand[] = buyers.map(playerId => ({ ...fixture.command,
        id: `market:buy:${playerId}`, playerId, type: "buy-player-market-listing", payload: { listingId } }));
      const purchases = await Promise.all([
        server.instanceManager.dispatchCommand(fixture.instanceId, commands[0]),
        secondServer.instanceManager.dispatchCommand(fixture.instanceId, commands[1])
      ]);
      expect(purchases.filter(result => result?.errors.length === 0)).toHaveLength(1);
      const settled = (await persistence.snapshotRepository.loadRecoveryHead(fixture.instanceId))!;
      expect(totals(settled.state)).toEqual(before);
      expect(settled.state.market!.playerListings).toHaveLength(0);
      expect(settled.state.resourceStatesById[sellerResource.id].balances.cash).toBe(sellerResource.balances.cash + 50);
      const winner = purchases.findIndex(result => result?.errors.length === 0);
      const replay = await secondServer.instanceManager.dispatchCommand(fixture.instanceId, commands[winner]);
      expect(replay?.commandResult).toEqual(purchases[winner]?.commandResult);
      expect(await persistence.snapshotRepository.loadRecoveryHead(fixture.instanceId)).toEqual(settled);
    } finally { await persistence.close(); await isolated.close(); }
  }, 90_000);
  run("rolls back every pre-commit command crash point and preserves exactly-once replay", async () => {
    const isolated = await createIsolatedPostgresTestSchema(live.databaseUrl!, "atomic_command_rollback");
    const persistence = createPostgresRuntimePersistenceRepositories({
      databaseUrl: isolated.databaseUrl,
      database: isolated.database
    });
    const server = createServerApp({ persistence });
    try {
      for (const crashPoint of commandCrashPoints) {
        const fixture = await createRuntimeFixture(server, `rollback-${crashPoint}`);
        const beforeState = structuredClone(fixture.runtime.state);
        const beforeHead = await persistence.snapshotRepository.loadRecoveryHead(fixture.instanceId);
        fixture.runtime.atomicCommandCrashInjector = (point) => {
          if (point === crashPoint) throw new Error(`Injected PostgreSQL crash at ${point}.`);
        };

        await expect(server.instanceManager.dispatchCommand(
          fixture.instanceId,
          fixture.command
        )).rejects.toThrow(`Injected PostgreSQL crash at ${crashPoint}.`);
        fixture.runtime.atomicCommandCrashInjector = undefined;

        expect(fixture.runtime.state).toEqual(beforeState);
        expect(await persistence.snapshotRepository.loadRecoveryHead(fixture.instanceId)).toEqual(beforeHead);
        await expect(commandPersistenceCounts(
          isolated.database,
          fixture.instanceId,
          fixture.command.id
        )).resolves.toEqual({
          reservations: 0,
          commandLog: 0,
          commandResults: 0,
          eventLog: 0,
          outbox: 0,
          recoveryHeads: beforeHead ? 1 : 0
        });
      }

      const replayFixture = await createRuntimeFixture(server, "exactly-once");
      const first = await server.instanceManager.dispatchCommand(
        replayFixture.instanceId,
        replayFixture.command
      );
      const rootAfterFirst = replayFixture.runtime.state.root.version;
      const replay = await server.instanceManager.dispatchCommand(
        replayFixture.instanceId,
        replayFixture.command,
        { expectedStateVersion: rootAfterFirst + 100 }
      );
      expect(first?.errors).toEqual([]);
      expect(replay?.errors).toEqual([]);
      expect(replay?.commandResult).toEqual(first?.commandResult);
      expect(replayFixture.runtime.state.root.version).toBe(rootAfterFirst);
      const replayCounts = await commandPersistenceCounts(
        isolated.database,
        replayFixture.instanceId,
        replayFixture.command.id
      );
      expect(replayCounts).toMatchObject({
        reservations: 1,
        commandLog: 1,
        commandResults: 1,
        eventLog: 1,
        outbox: 1,
        recoveryHeads: 1
      });
    } finally {
      await persistence.close();
      await isolated.close();
    }
  }, 120_000);

  run("rolls back recovery head and checkpoint when a durable tick fails before commit", async () => {
    const isolated = await createIsolatedPostgresTestSchema(live.databaseUrl!, "atomic_tick_rollback");
    const persistence = createPostgresRuntimePersistenceRepositories({
      databaseUrl: isolated.databaseUrl,
      database: isolated.database
    });
    const server = createServerApp({ persistence });
    try {
      const fixture = await createRuntimeFixture(server, "tick-checkpoint");
      const spawn = await server.instanceManager.dispatchCommand(fixture.instanceId, fixture.command);
      expect(spawn?.errors).toEqual([]);

      const checkpointTick = fixture.runtime.config.technical.snapshotIntervalTicks;
      fixture.runtime.state.root.tick = checkpointTick - 1;
      fixture.runtime.state.root.version += 1;
      fixture.runtime.scheduler.lastTickAtMs = null;
      await persistence.snapshotRepository.saveRecoveryHead(
        createInstanceSnapshot(fixture.runtime)
      );
      const beforeState = structuredClone(fixture.runtime.state);
      const beforeHead = await persistence.snapshotRepository.loadRecoveryHead(fixture.instanceId);
      const beforeCheckpoints = await persistence.snapshotRepository.countCheckpoints(fixture.instanceId);
      const published: unknown[] = [];
      fixture.runtime.eventPublisher = { publish: (event) => published.push(event) };

      const boundary = fixture.runtime.atomicCommandTransaction;
      if (!boundary) throw new Error("PostgreSQL tick fixture is missing its atomic boundary.");
      fixture.runtime.atomicCommandTransaction = failAfterCheckpointBoundary(boundary);

      await server.instanceManager.tickInstanceDurably(fixture.instanceId);

      expect(fixture.runtime.state).toEqual(beforeState);
      expect(fixture.runtime.record.status).toBe("crashed");
      expect(published).toEqual([]);
      expect(await persistence.snapshotRepository.loadRecoveryHead(fixture.instanceId)).toEqual(beforeHead);
      expect(await persistence.snapshotRepository.countCheckpoints(fixture.instanceId)).toEqual(beforeCheckpoints);
    } finally {
      await persistence.close();
      await isolated.close();
    }
  }, 90_000);
});

const createRuntimeFixture = async (
  server: ReturnType<typeof createServerApp>,
  label: string
) => {
  const suffix = crypto.randomUUID();
  const instanceId = `instance:free:postgres:${label}:${suffix}`;
  const playerId = `player:postgres:${label}:${suffix}`;
  const districtId = sharedCitySpawnDistrictIds[0] ?? "district:1";
  const ensured = await ensureGameplaySliceSessionResult(server.instanceManager, {
    serverInstanceId: instanceId,
    playerId,
    districtId
  });
  if (!ensured.accepted) throw new Error(`PostgreSQL runtime fixture failed: ${ensured.errors[0]?.code}`);
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error("PostgreSQL runtime fixture is missing.");
  return {
    runtime,
    instanceId,
    command: createSelectSpawnDistrictCommandFixture({
      id: `command:postgres:${label}:${suffix}`,
      serverInstanceId: instanceId,
      playerId,
      payload: { districtId }
    })
  };
};

const failAfterCheckpointBoundary = (
  boundary: AtomicCommandTransactionBoundary
): AtomicCommandTransactionBoundary => ({
  run: (instanceId, callback, options) => boundary.run(instanceId, (repositories) =>
    callback({
      ...repositories,
      snapshotRepository: {
        ...repositories.snapshotRepository,
        saveCheckpoint: async (checkpoint) => {
          await repositories.snapshotRepository.saveCheckpoint(checkpoint);
          throw new Error("Injected PostgreSQL tick crash after checkpoint insert.");
        }
      }
    }), options)
});

const commandPersistenceCounts = async (
  database: PostgresDatabase,
  instanceId: string,
  commandId: string
) => {
  const result = await database.query<Record<string, string | number>>(
    `SELECT
       (SELECT count(*) FROM empire_command_reservations WHERE command_id=$1) AS reservations,
       (SELECT count(*) FROM empire_command_log WHERE command_id=$1) AS command_log,
       (SELECT count(*) FROM empire_command_results WHERE command_id=$1) AS command_results,
       (SELECT count(*) FROM empire_event_log WHERE caused_by_command_id=$1) AS event_log,
       (SELECT count(*) FROM empire_runtime_outbox WHERE command_id=$1) AS outbox,
       (SELECT count(*) FROM empire_snapshot_latest WHERE server_instance_id=$2) AS recovery_heads`,
    [commandId, instanceId]
  );
  const row = result.rows[0] ?? {};
  return {
    reservations: Number(row.reservations ?? 0),
    commandLog: Number(row.command_log ?? 0),
    commandResults: Number(row.command_results ?? 0),
    eventLog: Number(row.event_log ?? 0),
    outbox: Number(row.outbox ?? 0),
    recoveryHeads: Number(row.recovery_heads ?? 0)
  };
};
