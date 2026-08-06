import { describe, expect, it, vi } from "vitest";
import {
  createHostedRuntimeWorker,
  createInMemoryHostedControlPlaneRepository,
  type HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import { createServerApp } from "../../apps/server/src/app";
import type { PostgresPlayerEntryRepository } from "../../apps/server/src/player-entry/postgres-player-entry-repository";
import { createInMemoryRuntimePersistenceRepositories } from "../../apps/server/src/runtime";
import {
  acceleratedLifecycleConfig,
  createTwentyPlayerLifecycleState
} from "../fixtures/full-free-lifecycle-fixture";

const INSTANCE_ID = "instance:hosted-full-lifecycle";
const START = new Date("2026-08-06T10:00:00.000Z");

describe("hosted full match lifecycle", () => {
  it("durably ticks 20 players to one result and lets the worker finalize exactly once", async () => {
    const persistence = createInMemoryRuntimePersistenceRepositories();
    let now = new Date(START);
    const clock = {
      now: () => new Date(now),
      nowIso: () => now.toISOString()
    };
    const app = createServerApp({ persistence, clock });
    const runtime = app.instanceManager.createInstance(INSTANCE_ID, "free", {
      displayName: "Hosted Full Lifecycle",
      region: "eu-central",
      capacity: 20
    });
    app.instanceManager.startInstance(INSTANCE_ID);
    runtime.config = acceleratedLifecycleConfig;
    runtime.state = createTwentyPlayerLifecycleState(INSTANCE_ID);
    runtime.record.status = "running";
    runtime.scheduler.isRunning = true;
    await app.instanceManager.saveInstanceSnapshot(INSTANCE_ID);

    for (let cycle = 0; cycle < 40 && !runtime.state.matchResult; cycle += 1) {
      now = new Date(now.getTime() + acceleratedLifecycleConfig.tickRateMs);
      await app.instanceManager.tickInstanceDurably(INSTANCE_ID);
      expect(runtime.record.status).not.toBe("crashed");
    }

    expect(runtime.state.matchResult).toBeTruthy();
    expect(runtime.state.eliminationState?.eliminatedPlayerIds).toHaveLength(12);
    const recoveryHead = await persistence.snapshotRepository.loadRecoveryHead(INSTANCE_ID);
    expect(recoveryHead).toMatchObject({
      tick: runtime.state.root.tick,
      integrity: { rootVersion: runtime.state.root.version },
      state: {
        root: { phase: "resolved" },
        matchResult: { id: runtime.state.matchResult?.id }
      }
    });
    if (!recoveryHead) throw new Error("Lifecycle recovery head was not persisted.");

    const controlPlane = createInMemoryHostedControlPlaneRepository({
      servers: [hostedRecord(recoveryHead.snapshotId)]
    });
    const syncResolvedMemberships = vi.fn(async () => undefined);
    const playerEntry = {
      claimMembershipJob: async () => null,
      syncResolvedMemberships
    } as unknown as PostgresPlayerEntryRepository;
    const worker = createHostedRuntimeWorker({
      workerId: "worker:hosted-full-lifecycle",
      region: "eu-central",
      buildSha: "test",
      controlPlane,
      server: app,
      playerEntry,
      now: () => new Date(now)
    });

    await worker.runOnce();
    await worker.runOnce();

    expect(syncResolvedMemberships).toHaveBeenCalledTimes(1);
    expect(syncResolvedMemberships).toHaveBeenCalledWith(
      INSTANCE_ID,
      expect.arrayContaining(runtime.state.eliminationState!.eliminatedPlayerIds),
      expect.objectContaining({ id: runtime.state.matchResult!.id }),
      expect.any(String)
    );
    expect(await controlPlane.getServer(INSTANCE_ID)).toMatchObject({
      status: "stopped",
      joinPolicy: "closed",
      currentSnapshotId: recoveryHead.snapshotId,
      runtimeLeaseOwnerId: null,
      runtimeLeaseExpiresAt: null
    });

    const recoveredApp = createServerApp({ persistence, clock });
    recoveredApp.instanceManager.createInstance(INSTANCE_ID, "free");
    const recovered = await recoveredApp.instanceManager.restoreInstance(INSTANCE_ID);
    expect(recovered?.state.root).toEqual(runtime.state.root);
    expect(recovered?.state.matchResult).toEqual(runtime.state.matchResult);
    expect(recovered?.state.eliminationState?.eliminatedPlayerIds).toHaveLength(12);
  });
});

const hostedRecord = (snapshotId: string): HostedServerRecord => ({
  serverInstanceId: INSTANCE_ID,
  mode: "free",
  serverTemplate: "full",
  displayName: "Hosted Full Lifecycle",
  region: "eu-central",
  capacity: 20,
  status: "running",
  joinPolicy: "closed",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 2,
  registrationWindowMinutes: 60,
  registrationScheduleVersion: 1,
  registrationOpensAt: new Date(START.getTime() - 60 * 60_000).toISOString(),
  registrationClosesAt: START.toISOString(),
  registrationClosedAt: START.toISOString(),
  registrationBaselinePlayers: 20,
  canonicalFinalLockdownTrigger: 8,
  canonicalFirstEliminationTick: 2,
  canonicalTickRateMs: acceleratedLifecycleConfig.tickRateMs,
  effectiveFinalLockdownTrigger: 8,
  effectiveFirstEliminationTick: 2,
  worldSeed: "full-free-lifecycle-seed",
  configVersion: 1,
  mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
  initialSnapshotId: snapshotId,
  currentSnapshotId: snapshotId,
  runtimeLeaseOwnerId: null,
  runtimeLeaseExpiresAt: null,
  lastWorkerHeartbeatAt: null,
  lastStartedAt: START.toISOString(),
  lastPausedAt: null,
  lastStoppedAt: null,
  lastErrorCode: null,
  createdByAdminUserId: "admin:test",
  createdAt: START.toISOString(),
  updatedAt: START.toISOString(),
  version: 1
});
