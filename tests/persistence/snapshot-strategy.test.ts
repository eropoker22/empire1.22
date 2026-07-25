import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_CHECKPOINT_CADENCE_MS,
  resolveModeConfig
} from "@empire/game-config";
import {
  SNAPSHOT_CHECKPOINT_KINDS,
  createDueAuthoritativeCheckpoint,
  createInstanceSnapshot,
  createLifecycleCheckpoint,
  createServerInstanceRuntime,
  createSnapshotCheckpoint,
  createSnapshotMaintenanceRunner,
  defaultRetentionPolicy,
  validateSnapshotIntegrity
} from "../../apps/server/src/runtime";
import { createInMemorySnapshotRepository } from
  "../../apps/server/src/runtime/persistence/repositories";

describe("snapshot recovery head and checkpoint strategy", () => {
  it("keeps exactly one recovery head after one hundred authoritative updates", async () => {
    const repository = createInMemorySnapshotRepository();
    const runtime = createServerInstanceRuntime("instance:snapshot:one-head", "free");

    for (let tick = 1; tick <= 100; tick += 1) {
      runtime.state.root.tick = tick;
      runtime.state.root.version = tick + 1;
      await repository.saveRecoveryHead(createInstanceSnapshot(runtime));
    }

    await expect(repository.loadRecoveryHead(runtime.record.id)).resolves.toMatchObject({
      tick: 100,
      integrity: { rootVersion: 101 }
    });
    await expect(repository.countCheckpoints(runtime.record.id)).resolves.toEqual({
      total: 0,
      rolling: 0,
      lifecycle: 0,
      terminal: 0
    });
    expect(repository.getMetrics().recoveryHeadUpdates).toBe(100);
  });

  it("creates periodic checkpoints from wall-clock mode cadence instead of every tick", () => {
    const free = resolveModeConfig("free");
    const war = resolveModeConfig("war");
    expect(free.technical.snapshotIntervalTicks).toBe(30);
    expect(war.technical.snapshotIntervalTicks).toBe(20);
    expect(free.technical.snapshotIntervalTicks * free.tickRateMs).toBe(SNAPSHOT_CHECKPOINT_CADENCE_MS);
    expect(war.technical.snapshotIntervalTicks * war.tickRateMs).toBe(SNAPSHOT_CHECKPOINT_CADENCE_MS);

    const runtime = createServerInstanceRuntime("instance:snapshot:cadence", "free");
    runtime.state.root.phase = "live";
    runtime.state.root.tick = 29;
    runtime.state.root.version = 30;
    const beforeDue = createDueAuthoritativeCheckpoint({
      snapshot: createInstanceSnapshot(runtime),
      previousPhase: "live",
      snapshotIntervalTicks: free.technical.snapshotIntervalTicks
    });
    runtime.state.root.tick = 30;
    runtime.state.root.version = 31;
    const due = createDueAuthoritativeCheckpoint({
      snapshot: createInstanceSnapshot(runtime),
      previousPhase: "live",
      snapshotIntervalTicks: free.technical.snapshotIntervalTicks
    });

    expect(beforeDue).toBeNull();
    expect(due).toMatchObject({
      kind: SNAPSHOT_CHECKPOINT_KINDS.periodic,
      reasonCode: "periodic-cadence",
      tick: 30,
      rootVersion: 31
    });
  });

  it("creates protected lifecycle and terminal checkpoints without duplicate identities", async () => {
    const repository = createInMemorySnapshotRepository();
    const runtime = createServerInstanceRuntime("instance:snapshot:lifecycle", "free");
    runtime.state.root.phase = "final_lockdown";
    runtime.state.root.version += 1;
    const finalLockdown = createDueAuthoritativeCheckpoint({
      snapshot: createInstanceSnapshot(runtime),
      previousPhase: "live",
      snapshotIntervalTicks: 30
    });
    if (!finalLockdown) throw new Error("Expected Final Lockdown checkpoint.");
    expect(finalLockdown).toMatchObject({
      kind: SNAPSHOT_CHECKPOINT_KINDS.lifecycle,
      reasonCode: "final-lockdown-entered",
      protected: true
    });
    expect(await repository.saveCheckpoint(finalLockdown)).toBe("created");
    expect(await repository.saveCheckpoint(structuredClone(finalLockdown))).toBe("idempotent");

    runtime.state.root.phase = "resolved";
    runtime.state.root.version += 1;
    const terminal = createDueAuthoritativeCheckpoint({
      snapshot: createInstanceSnapshot(runtime),
      previousPhase: "final_lockdown",
      snapshotIntervalTicks: 30
    });
    expect(terminal).toMatchObject({
      kind: SNAPSHOT_CHECKPOINT_KINDS.terminal,
      reasonCode: "instance-completed",
      protected: true
    });
    expect(terminal?.checkpointId).not.toBe(finalLockdown.checkpointId);
  });

  it("recovers from the newest valid checkpoint when a recovery head is missing", async () => {
    const repository = createInMemorySnapshotRepository();
    const runtime = createServerInstanceRuntime("instance:snapshot:fallback", "free");
    runtime.state.root.tick = 30;
    runtime.state.root.version = 9;
    const snapshot = createInstanceSnapshot(runtime);
    await repository.saveCheckpoint(createSnapshotCheckpoint(snapshot, {
      kind: SNAPSHOT_CHECKPOINT_KINDS.periodic,
      reasonCode: "periodic-cadence"
    }));

    await expect(repository.loadForRecovery(runtime.record.id)).resolves.toMatchObject({
      source: "checkpoint-fallback",
      reasonCode: "RECOVERY_HEAD_MISSING_CHECKPOINT_USED",
      snapshot: { snapshotId: snapshot.snapshotId }
    });
    await expect(repository.loadRecoveryHead(runtime.record.id)).resolves.toEqual(snapshot);
    expect(repository.getMetrics().recoveryFromCheckpointFallback).toBe(1);
  });

  it("fails integrity validation for a corrupt head payload", () => {
    const runtime = createServerInstanceRuntime("instance:snapshot:corrupt", "free");
    const snapshot = createInstanceSnapshot(runtime);
    snapshot.integrity.entityCounts.players += 1;
    expect(validateSnapshotIntegrity(snapshot, runtime.record.id)).toEqual({
      valid: false,
      failureCode: "SNAPSHOT_ENTITY_COUNTS_MISMATCH"
    });
  });

  it("retains the head, protected lifecycle checkpoint, and configured rolling window", async () => {
    const repository = createInMemorySnapshotRepository();
    const runtime = createServerInstanceRuntime("instance:snapshot:retention", "free");
    runtime.state.root.phase = "live";
    await repository.saveCheckpoint(createLifecycleCheckpoint(
      createInstanceSnapshot(runtime),
      "instance-started",
      { protected: true }
    ));
    for (let tick = 1; tick <= 10; tick += 1) {
      runtime.state.root.tick = tick;
      runtime.state.root.version += 1;
      const snapshot = createInstanceSnapshot(runtime);
      await repository.saveRecoveryHead(snapshot);
      await repository.saveCheckpoint(createSnapshotCheckpoint(snapshot, {
        kind: SNAPSHOT_CHECKPOINT_KINDS.periodic,
        reasonCode: "periodic-cadence"
      }));
    }
    const policy = {
      ...defaultRetentionPolicy.snapshots,
      rollingCheckpointCountActive: 3,
      cleanupBatchSize: 100
    };

    await expect(repository.cleanupCheckpoints(policy, "2026-07-25T12:00:00.000Z"))
      .resolves.toMatchObject({ acquired: true, deletedRows: 7 });
    await expect(repository.countCheckpoints(runtime.record.id)).resolves.toEqual({
      total: 4,
      rolling: 3,
      lifecycle: 1,
      terminal: 0
    });
    await expect(repository.loadRecoveryHead(runtime.record.id)).resolves.toMatchObject({ tick: 10 });
    await expect(repository.cleanupCheckpoints(policy, "2026-07-25T12:15:00.000Z"))
      .resolves.toMatchObject({ deletedRows: 0 });
  });

  it("deduplicates concurrent maintenance calls and enforces the batch policy", async () => {
    const repository = createInMemorySnapshotRepository();
    const runtime = createServerInstanceRuntime("instance:snapshot:maintenance", "free");
    for (let tick = 1; tick <= 8; tick += 1) {
      runtime.state.root.tick = tick;
      runtime.state.root.version += 1;
      const snapshot = createInstanceSnapshot(runtime);
      await repository.saveCheckpoint(createSnapshotCheckpoint(snapshot, {
        kind: SNAPSHOT_CHECKPOINT_KINDS.periodic,
        reasonCode: "periodic-cadence"
      }));
    }
    const runner = createSnapshotMaintenanceRunner(repository, {
      ...defaultRetentionPolicy.snapshots,
      rollingCheckpointCountActive: 1,
      cleanupBatchSize: 2
    }, { log: () => undefined });

    const [first, second] = await Promise.all([
      runner.runNow("2026-07-25T12:00:00.000Z"),
      runner.runNow("2026-07-25T12:00:00.000Z")
    ]);

    expect(first).toEqual(second);
    expect(first.deletedRows).toBe(2);
    expect(runner.getHealth()).toMatchObject({
      lastStatus: "success",
      lastDeletedRows: 2
    });
  });
});
