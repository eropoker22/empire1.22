import { describe, expect, it } from "vitest";
import type { InstanceRuntimeEvent } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import { sharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import type {
  AtomicCommandTransactionBoundary,
  AtomicCommandTransactionRepositories
} from "../../apps/server/src/runtime/instance-manager/atomic-command-transaction";
import { RuntimeLeaseFenceRejectedError } from
  "../../apps/server/src/runtime/instance-manager/atomic-command-transaction";
import { createInstanceSnapshot } from "../../apps/server/src/runtime/persistence";
import { createFixedClock } from "../../apps/server/src/runtime/scheduling";
import {
  createCraftItemCommandFixture,
  createPlaceTrapCommandFixture,
  createSelectSpawnDistrictCommandFixture
} from "../fixtures/command-fixtures";

describe("atomic hosted tick persistence", () => {
  it("serializes a tick and command without losing either committed mutation", async () => {
    const fixture = await createFixture("concurrent");
    let committedBoundaries = 0;
    const published: InstanceRuntimeEvent[] = [];
    fixture.runtime.atomicCommandTransaction = createSerializedBoundary(fixture.repositories, () => {
      committedBoundaries += 1;
    });
    fixture.runtime.eventPublisher = {
      publish: (event) => {
        expect(committedBoundaries).toBeGreaterThan(0);
        published.push(event);
      }
    };
    const rootVersionBefore = fixture.runtime.state.root.version;
    const trapCommand = createPlaceTrapCommandFixture({
      id: `command:atomic-tick:${fixture.name}:trap`,
      playerId: fixture.playerId,
      serverInstanceId: fixture.instanceId,
      payload: { districtId: fixture.districtId }
    });

    const [ticked, dispatched] = await Promise.all([
      fixture.server.instanceManager.tickInstanceDurably(fixture.instanceId),
      fixture.server.instanceManager.dispatchCommand(fixture.instanceId, trapCommand)
    ]);
    const latest = await fixture.repositories.snapshotRepository.loadLatest(fixture.instanceId);

    expect(dispatched?.errors).toEqual([]);
    expect(ticked?.state.root.tick).toBe(1);
    expect(latest?.state.root.tick).toBe(1);
    expect(latest?.state.root.version).toBeGreaterThanOrEqual(rootVersionBefore + 2);
    expect(latest?.state.root.trapIds).toHaveLength(1);
    expect(latest?.runtime.processedCommandIds).toContain(trapCommand.id);
    expect(fixture.runtime.state).toEqual(latest?.state);
    expect(published.map((event) => event.type)).toContain("tick-completed");
  });

  it("holds the instance lock through tick commit and live-state publication", async () => {
    const fixture = await createFixture("publish-race");
    let boundaryCalls = 0;
    let releaseTick!: () => void;
    let reportTickCommitted!: () => void;
    let commandBoundaryStarted = false;
    const tickCommitted = new Promise<void>((resolve) => {
      reportTickCommitted = resolve;
    });
    const tickCanPublish = new Promise<void>((resolve) => {
      releaseTick = resolve;
    });
    fixture.runtime.atomicCommandTransaction = {
      run: async (_instanceId, callback) => {
        boundaryCalls += 1;
        const result = await callback(fixture.repositories);
        if (boundaryCalls === 1) {
          reportTickCommitted();
          await tickCanPublish;
        } else {
          commandBoundaryStarted = true;
        }
        return result;
      }
    };
    const trapCommand = createPlaceTrapCommandFixture({
      id: `command:atomic-tick:${fixture.name}:trap`,
      playerId: fixture.playerId,
      serverInstanceId: fixture.instanceId,
      payload: { districtId: fixture.districtId }
    });

    const tickPromise = fixture.server.instanceManager.tickInstanceDurably(fixture.instanceId);
    await tickCommitted;
    const commandPromise = fixture.server.instanceManager.dispatchCommand(fixture.instanceId, trapCommand);
    expect(commandBoundaryStarted).toBe(false);
    releaseTick();
    await Promise.all([tickPromise, commandPromise]);

    const latest = await fixture.repositories.snapshotRepository.loadRecoveryHead(fixture.instanceId);
    expect(commandBoundaryStarted).toBe(true);
    expect(latest?.state.root.tick).toBe(1);
    expect(latest?.state.root.trapIds).toHaveLength(1);
    expect(fixture.runtime.state).toEqual(latest?.state);
  });

  it("does not publish or replace runtime state when the atomic snapshot write fails", async () => {
    const fixture = await createFixture("rollback");
    const beforeState = structuredClone(fixture.runtime.state);
    const beforeSnapshot = await fixture.repositories.snapshotRepository.loadLatest(fixture.instanceId);
    const published: InstanceRuntimeEvent[] = [];
    fixture.runtime.eventPublisher = { publish: (event) => published.push(event) };
    fixture.runtime.atomicCommandTransaction = createSerializedBoundary({
      ...fixture.repositories,
      snapshotRepository: {
        ...fixture.repositories.snapshotRepository,
        saveRecoveryHead: async () => {
          throw new Error("Injected tick snapshot failure.");
        }
      }
    });

    await fixture.server.instanceManager.tickInstanceDurably(fixture.instanceId);
    const latest = await fixture.repositories.snapshotRepository.loadLatest(fixture.instanceId);

    expect(fixture.runtime.state).toEqual(beforeState);
    expect(latest).toEqual(beforeSnapshot);
    expect(fixture.runtime.record.status).toBe("crashed");
    expect(fixture.runtime.scheduler.isRunning).toBe(false);
    expect(fixture.runtime.scheduler.tickInProgress).toBe(false);
    expect(published).toEqual([]);
  });

  it("rolls back a staged tick without crashing when the lease fence is lost", async () => {
    const fixture = await createFixture("lease-fence-lost");
    const beforeState = structuredClone(fixture.runtime.state);
    const beforeSnapshot = await fixture.repositories.snapshotRepository.loadLatest(fixture.instanceId);
    const published: InstanceRuntimeEvent[] = [];
    const fence = { workerId: "worker:stable", workerIncarnationId: "worker-incarnation:old" };
    fixture.runtime.eventPublisher = { publish: (event) => published.push(event) };
    fixture.runtime.atomicCommandTransaction = {
      run: async (_instanceId, callback, options) => {
        expect(options?.runtimeLeaseFence).toEqual(fence);
        await callback({ ...fixture.repositories, snapshotRepository: {
          ...fixture.repositories.snapshotRepository,
          saveRecoveryHead: async () => "updated"
        } });
        throw new RuntimeLeaseFenceRejectedError(fixture.instanceId);
      }
    };

    await expect(fixture.server.instanceManager.tickInstanceDurably(fixture.instanceId, fence))
      .rejects.toBeInstanceOf(RuntimeLeaseFenceRejectedError);

    expect(fixture.runtime.state).toEqual(beforeState);
    expect(await fixture.repositories.snapshotRepository.loadLatest(fixture.instanceId)).toEqual(beforeSnapshot);
    expect(fixture.runtime.record.status).toBe("running");
    expect(fixture.runtime.scheduler.isRunning).toBe(true);
    expect(fixture.runtime.scheduler.tickInProgress).toBe(false);
    expect(published).toEqual([]);
  });

  it("updates one recovery head every tick and checkpoints only at the configured cadence", async () => {
    const fixture = await createFixture("checkpoint-cadence");
    fixture.runtime.atomicCommandTransaction = createSerializedBoundary(fixture.repositories);

    for (let index = 0; index < fixture.runtime.config.technical.snapshotIntervalTicks; index += 1) {
      fixture.runtime.scheduler.lastTickAtMs = null;
      await fixture.server.instanceManager.tickInstanceDurably(fixture.instanceId);
    }

    const head = await fixture.repositories.snapshotRepository.loadRecoveryHead(fixture.instanceId);
    const checkpointCounts = await fixture.repositories.snapshotRepository.countCheckpoints(fixture.instanceId);
    expect(head?.tick).toBe(fixture.runtime.config.technical.snapshotIntervalTicks);
    expect(checkpointCounts).toMatchObject({
      total: 2,
      rolling: 1,
      lifecycle: 1,
      terminal: 0
    });
  });

  it("persists tick income and instant Pharmacy production in the recovery head", async () => {
    const fixture = await createFixture("production-income", "district:26");
    fixture.runtime.atomicCommandTransaction = createSerializedBoundary(fixture.repositories);
    const district = fixture.runtime.state.districtsById[fixture.districtId];
    const pharmacy = district?.buildingIds
      .map((buildingId) => fixture.runtime.state.buildingsById[buildingId])
      .find((building) => building?.buildingTypeId === "pharmacy");
    const player = fixture.runtime.state.playersById[fixture.playerId];
    if (!district || !pharmacy || !player) {
      throw new Error("Atomic tick production fixture requires a claimed Pharmacy district.");
    }
    const playerResources = fixture.runtime.state.resourceStatesById[player.resourceStateId];
    if (!playerResources) {
      throw new Error("Atomic tick production fixture requires player resources.");
    }

    fixture.runtime.state = {
      ...fixture.runtime.state,
      districtsById: {
        ...fixture.runtime.state.districtsById,
        [district.id]: {
          ...district,
          resourceModifiers: {
            ...district.resourceModifiers,
            cash: 5
          },
          stabilizingUntilTick: null,
          version: district.version + 1
        }
      },
      resourceStatesById: {
        ...fixture.runtime.state.resourceStatesById,
        [playerResources.id]: {
          ...playerResources,
          balances: {
            ...playerResources.balances,
            cash: 10_000
          },
          version: playerResources.version + 1
        }
      },
      root: {
        ...fixture.runtime.state.root,
        version: fixture.runtime.state.root.version + 1
      }
    };
    await fixture.repositories.snapshotRepository.saveRecoveryHead(
      createInstanceSnapshot(fixture.runtime)
    );
    const chemicalsBeforeCraft = Number(
      fixture.runtime.state.resourceStatesById[player.resourceStateId]?.balances.chemicals ?? 0
    );

    const crafted = await fixture.server.instanceManager.dispatchCommand(
      fixture.instanceId,
      createCraftItemCommandFixture({
        id: `command:atomic-tick:${fixture.name}:craft`,
        playerId: fixture.playerId,
        serverInstanceId: fixture.instanceId,
        payload: {
          districtId: fixture.districtId,
          buildingId: pharmacy.id,
          recipeId: "chemicals",
          quantity: 1
        }
      })
    );
    expect(crafted?.errors).toEqual([]);

    const cashAfterCraft = Number(
      fixture.runtime.state.resourceStatesById[player.resourceStateId]?.balances.cash ?? 0
    );
    expect(fixture.runtime.state.resourceStatesById[player.resourceStateId]?.balances.chemicals)
      .toBe(chemicalsBeforeCraft + 1);
    expect(fixture.runtime.state.buildingsById[pharmacy.id]?.processing).toBeNull();
    expect(fixture.runtime.state.buildingsById[pharmacy.id]?.productionLines?.chemicals).toBeUndefined();

    fixture.runtime.scheduler.lastTickAtMs = null;
    await fixture.server.instanceManager.tickInstanceDurably(fixture.instanceId);

    const latest = await fixture.repositories.snapshotRepository.loadRecoveryHead(fixture.instanceId);
    const persistedPharmacy = latest?.state.buildingsById[pharmacy.id];
    const persistedOutput = latest?.state.resourceStatesById[`resource:${pharmacy.id}`];
    const persistedPlayerResources = latest?.state.resourceStatesById[player.resourceStateId];

    expect(latest?.state.root.tick).toBe(1);
    expect(persistedPharmacy?.processing).toBeNull();
    expect(persistedPharmacy?.productionLines?.chemicals).toBeUndefined();
    expect(Number(persistedOutput?.balances.chemicals ?? 0)).toBe(0);
    expect(persistedPlayerResources?.balances.chemicals).toBe(chemicalsBeforeCraft + 1);
    expect(Number(persistedPlayerResources?.balances.cash ?? 0)).toBeGreaterThan(cashAfterCraft);
    expect(fixture.runtime.state).toEqual(latest?.state);
  });
});

const createFixture = async (
  name: string,
  districtId = sharedCitySpawnDistrictIds[0] ?? "district:1"
) => {
  const server = createServerApp();
  const instanceId = `instance:free:atomic-tick:${name}`;
  const playerId = `player:atomic-tick:${name}`;
  await ensureGameplaySliceSessionResult(server.instanceManager, {
    serverInstanceId: instanceId,
    playerId,
    districtId
  });
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error("Atomic tick fixture failed to create a runtime.");
  const spawn = await server.instanceManager.dispatchCommand(instanceId, createSelectSpawnDistrictCommandFixture({
    id: `command:atomic-tick:${name}:spawn`,
    playerId,
    serverInstanceId: instanceId,
    payload: { districtId }
  }));
  if (spawn?.errors.length) throw new Error(`Atomic tick fixture spawn failed: ${spawn.errors[0]?.code}`);
  runtime.scheduler.lastTickAtMs = null;
  const persistence = server.instanceManager.getPersistenceRepositories();
  if (!persistence.commandReservationRepository || !persistence.commandResultRepository || !persistence.outboxRepository) {
    throw new Error("Atomic tick fixture requires complete persistence repositories.");
  }
  const repositories: AtomicCommandTransactionRepositories = {
    commandLogRepository: persistence.commandLogRepository,
    commandReservationRepository: persistence.commandReservationRepository,
    commandResultRepository: persistence.commandResultRepository,
    eventLogRepository: persistence.eventLogRepository,
    outboxRepository: persistence.outboxRepository,
    snapshotRepository: persistence.snapshotRepository
  };
  return { name, server, runtime, instanceId, playerId, districtId, repositories };
};

const createSerializedBoundary = (
  repositories: AtomicCommandTransactionRepositories,
  afterCommit: () => void = () => undefined
): AtomicCommandTransactionBoundary => {
  let tail = Promise.resolve();
  return {
    run: (_instanceId, callback) => {
      const current = tail.then(async () => {
        const result = await callback(repositories);
        afterCommit();
        return result;
      });
      tail = current.then(() => undefined, () => undefined);
      return current;
    }
  };
};
