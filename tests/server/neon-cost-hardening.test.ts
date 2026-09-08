import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runTick } from "@empire/game-core";
import type { HostedServerRecord } from "../../apps/server/src/admin/hosted";
import { createServerApp } from "../../apps/server/src/app";
import { createHostedRuntimeLoader } from "../../apps/server/src/bootstrap/hosted-runtime-loader";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import type { AtomicCommandTransactionRepositories } from
  "../../apps/server/src/runtime/instance-manager/atomic-command-transaction";
import { createInMemoryRuntimePersistenceRepositories } from
  "../../apps/server/src/runtime/instance-manager/instance-factory";
import { createInstanceSnapshot } from "../../apps/server/src/runtime/persistence";

describe("Neon cost hardening", () => {
  it("performs zero full recovery reads across 100 stable authoritative ticks", async () => {
    const fixture = await createTickFixture("idle-100");
    const before = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);

    await runDurableTicks(fixture, 100);

    const after = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    expect(after.fullSnapshotReads - before.fullSnapshotReads).toBe(0);
    expect(after.metadataOnlyReads - before.metadataOnlyReads).toBe(100);
    expect(after.fullSnapshotWrites - before.fullSnapshotWrites).toBe(100);
  }, 20_000);

  it("reloads exactly once after an external command version and remains hot for 100 more ticks", async () => {
    const fixture = await createTickFixture("external-command");
    const external = await fixture.persistence.snapshotRepository.loadRecoveryHead(fixture.instanceId);
    if (!external) throw new Error("External command fixture requires a recovery head.");
    external.state.root.version += 1;
    external.integrity.rootVersion = external.state.root.version;
    external.snapshotId = `${external.snapshotId}:external`;
    await fixture.persistence.snapshotRepository.saveRecoveryHead(external);
    const beforeMismatch = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);

    await runDurableTicks(fixture, 1);

    const afterMismatch = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    expect(afterMismatch.fullSnapshotReads - beforeMismatch.fullSnapshotReads).toBe(1);
    expect(fixture.runtime.state.root.version).toBeGreaterThan(external.integrity.rootVersion);
    expect(fixture.runtime.state.root.tick).toBe(external.tick + 1);
    const beforeStable = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    await runDurableTicks(fixture, 100);
    const afterStable = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    expect(afterStable.fullSnapshotReads - beforeStable.fullSnapshotReads).toBe(0);
  }, 20_000);

  it("hydrates once on worker restart and preserves the exact committed state", async () => {
    const fixture = await createTickFixture("restart");
    await runDurableTicks(fixture, 5);
    const expected = structuredClone(fixture.runtime.state);
    const before = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    const restarted = createServerApp({ persistence: fixture.persistence });
    const runtime = restarted.instanceManager.createInstance(fixture.instanceId, "free");

    await restarted.instanceManager.restoreInstance(fixture.instanceId);

    const after = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    expect(after.fullSnapshotReads - before.fullSnapshotReads).toBe(1);
    expect(runtime.state).toMatchObject(expected);
  });

  it("keeps 20-player unchanged polling on metadata without linear full snapshot reads", async () => {
    const fixture = await createTickFixture("polling-20p");
    const record = createHostedRecord(fixture);
    const loader = createHostedRuntimeLoader({
      server: fixture.server,
      controlPlane: { getServer: async () => record }
    });
    const before = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);

    for (let cycle = 0; cycle < 6; cycle += 1) {
      await Promise.all(Array.from({ length: 20 }, () => loader.load(fixture.instanceId)));
    }

    const after = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    expect(after.fullSnapshotReads - before.fullSnapshotReads).toBe(0);
    expect(after.metadataOnlyReads - before.metadataOnlyReads).toBe(6);

    fixture.server.instanceManager.destroyInstance(fixture.instanceId);
    const coldBefore = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    const conditional = await loader.load(fixture.instanceId, {
      knownStateVersion: fixture.runtime.state.root.version,
      allowUnhydratedUnchanged: true
    });
    const coldAfter = fixture.persistence.snapshotRepository.getInstanceIoMetrics(fixture.instanceId);
    expect(conditional).toMatchObject({ accepted: true, unchanged: true, runtime: null });
    expect(coldAfter.fullSnapshotReads - coldBefore.fullSnapshotReads).toBe(0);
  });

  it("matches the reference game state after 1000 optimized ticks", async () => {
    const fixture = await createTickFixture("differential-1000");
    await runDurableTicks(fixture, 1);
    let reference = structuredClone(fixture.runtime.state);

    for (let index = 0; index < 1_000; index += 1) {
      const previousVersion = reference.root.version;
      const result = runTick(reference, { config: fixture.runtime.config });
      reference = result.nextState.root.version > previousVersion
        ? result.nextState
        : { ...result.nextState, root: { ...result.nextState.root, version: previousVersion + 1 } };
      await runDurableTicks(fixture, 1);
    }

    expect(fixture.runtime.state).toEqual(reference);
  }, 120_000);

  it("keeps the hot metadata SQL payload-free", async () => {
    const source = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/postgres-snapshot-metadata.ts",
      import.meta.url
    ), "utf8");
    const query = source.match(/SELECT snapshot_id, root_version, tick, created_at, updated_at[\s\S]*?\[instanceId\]/u)?.[0];
    expect(query).toBeTruthy();
    expect(query).not.toMatch(/\bpayload\b/u);
  });
});

const createTickFixture = async (name: string) => {
  const persistence = createInMemoryRuntimePersistenceRepositories();
  const server = createServerApp({ persistence });
  const instanceId = `instance:free:neon-cost:${name}`;
  await ensureGameplaySliceSessionResult(server.instanceManager, {
    serverInstanceId: instanceId,
    playerId: `player:neon-cost:${name}`,
    districtId: "district:501"
  });
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error("Neon cost fixture failed to create runtime.");
  await persistence.snapshotRepository.saveRecoveryHead(createInstanceSnapshot(runtime));
  if (!persistence.commandReservationRepository || !persistence.commandResultRepository || !persistence.outboxRepository) {
    throw new Error("Neon cost fixture requires complete persistence repositories.");
  }
  const repositories: AtomicCommandTransactionRepositories = {
    commandLogRepository: persistence.commandLogRepository,
    commandReservationRepository: persistence.commandReservationRepository,
    commandResultRepository: persistence.commandResultRepository,
    eventLogRepository: persistence.eventLogRepository,
    outboxRepository: persistence.outboxRepository,
    snapshotRepository: persistence.snapshotRepository
  };
  runtime.atomicCommandTransaction = { run: async (_instanceId, callback) => callback(repositories) };
  return { server, persistence, runtime, instanceId };
};

const runDurableTicks = async (
  fixture: Awaited<ReturnType<typeof createTickFixture>>,
  count: number
) => {
  for (let index = 0; index < count; index += 1) {
    fixture.runtime.scheduler.lastTickAtMs = null;
    await fixture.server.instanceManager.tickInstanceDurably(fixture.instanceId);
  }
};

const createHostedRecord = (
  fixture: Awaited<ReturnType<typeof createTickFixture>>
): HostedServerRecord => ({
  serverInstanceId: fixture.instanceId,
  mode: "free",
  serverTemplate: "free-public" as HostedServerRecord["serverTemplate"],
  displayName: "Neon cost test",
  region: "local",
  capacity: 20,
  status: "running",
  joinPolicy: "open",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 1,
  registrationWindowMinutes: 5,
  registrationScheduleVersion: 1,
  registrationOpensAt: null,
  registrationClosesAt: null,
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: null,
  canonicalFirstEliminationTick: null,
  canonicalTickRateMs: 10_000,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  version: 1,
  lastWorkerHeartbeatAt: null,
  runtimeLeaseOwnerId: null,
  runtimeLeaseExpiresAt: null,
  currentSnapshotId: null,
  lastErrorCode: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  worldSeed: fixture.runtime.state.serverInstance.worldSeed,
  configVersion: 1,
  mapComposition: { kind: "canonical-shared-city" } as unknown as HostedServerRecord["mapComposition"],
  initialSnapshotId: null,
  createdByAdminUserId: "admin:test",
  lastStartedAt: new Date(0).toISOString(),
  lastPausedAt: null,
  lastStoppedAt: null
});
