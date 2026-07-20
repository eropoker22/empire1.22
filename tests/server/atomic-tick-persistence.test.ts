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
import { createFixedClock } from "../../apps/server/src/runtime/scheduling";
import {
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

  it("does not publish or replace runtime state when the atomic snapshot write fails", async () => {
    const fixture = await createFixture("rollback");
    const beforeState = structuredClone(fixture.runtime.state);
    const beforeSnapshot = await fixture.repositories.snapshotRepository.loadLatest(fixture.instanceId);
    const published: InstanceRuntimeEvent[] = [];
    fixture.runtime.eventPublisher = { publish: (event) => published.push(event) };
    fixture.runtime.atomicCommandTransaction = createSerializedBoundary({
      ...fixture.repositories,
      snapshotRepository: {
        loadLatest: fixture.repositories.snapshotRepository.loadLatest,
        save: async () => {
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
          loadLatest: fixture.repositories.snapshotRepository.loadLatest,
          save: async () => undefined
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
});

const createFixture = async (name: string) => {
  const server = createServerApp();
  const instanceId = `instance:free:atomic-tick:${name}`;
  const playerId = `player:atomic-tick:${name}`;
  const districtId = sharedCitySpawnDistrictIds[0] ?? "district:1";
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
