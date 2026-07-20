import { describe, expect, it } from "vitest";
import {
  createInMemoryHostedControlPlaneRepository,
  type HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import { createHostedRuntimeLeaseClient } from
  "../../apps/server/src/admin/hosted/hosted-runtime-lease-client";

const T0 = "2026-07-20T10:00:00.000Z";
const T1 = "2026-07-20T10:01:00.000Z";
const T2 = "2026-07-20T10:02:00.000Z";
const T3 = "2026-07-20T10:03:00.000Z";
const T4 = "2026-07-20T10:04:00.000Z";

describe("hosted runtime lease incarnation fencing", () => {
  it("creates a distinct default incarnation for each worker process object", () => {
    const controlPlane = createInMemoryHostedControlPlaneRepository();
    const first = createHostedRuntimeLeaseClient({ controlPlane, workerId: "worker:stable", now: () => new Date(T0) });
    const second = createHostedRuntimeLeaseClient({ controlPlane, workerId: "worker:stable", now: () => new Date(T0) });

    expect(first.workerIncarnationId).not.toBe(second.workerIncarnationId);
  });

  it("does not let a restarted process renew or mutate its predecessor's live lease", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({ servers: [server({ status: "lobby" })] });
    const oldFence = lease("worker-incarnation:old", T0, T2);
    const newFence = lease("worker-incarnation:new", T1, T3);

    await register(repository, oldFence.workerIncarnationId, T0);
    expect(await repository.acquireRuntimeLease(oldFence)).toBe(true);
    await register(repository, newFence.workerIncarnationId, T1);
    expect(await repository.acquireRuntimeLease(newFence)).toBe(false);
    expect(await repository.isRuntimeLeaseCurrent({ serverInstanceId: oldFence.serverInstanceId,
      workerId: oldFence.workerId, workerIncarnationId: oldFence.workerIncarnationId, at: T1 })).toBe(true);

    await register(repository, newFence.workerIncarnationId, T1, T2);
    expect(await repository.acquireRuntimeLease({ ...newFence, now: T2, expiresAt: T4 })).toBe(true);
    expect(await repository.isRuntimeLeaseCurrent({ serverInstanceId: oldFence.serverInstanceId,
      workerId: oldFence.workerId, workerIncarnationId: oldFence.workerIncarnationId, at: T2 })).toBe(false);
    await repository.writeInstanceHeartbeat({ serverInstanceId: oldFence.serverInstanceId,
      workerId: oldFence.workerId, workerIncarnationId: oldFence.workerIncarnationId, leaseExpiresAt: T4,
      lastTick: 99, lastSnapshotAt: T2, lastErrorCode: "STALE", at: T3 });
    await repository.releaseRuntimeLease(oldFence.serverInstanceId, oldFence.workerId,
      oldFence.workerIncarnationId, T3);

    expect(await repository.getServer(oldFence.serverInstanceId)).toMatchObject({
      runtimeLeaseOwnerId: oldFence.workerId,
      runtimeLeaseExpiresAt: T4,
      lastWorkerHeartbeatAt: T2,
      lastErrorCode: null
    });
  });

  it("fences resolved-server finalization by incarnation and clears the winning lease", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({ servers: [server()] });
    await register(repository, "worker-incarnation:current", T0);
    expect(await repository.acquireRuntimeLease(lease("worker-incarnation:current", T0, T4))).toBe(true);
    expect(await repository.finalizeResolvedServer({ serverInstanceId: "instance:lease-incarnation",
      workerId: "worker:stable", workerIncarnationId: "worker-incarnation:old", expectedVersion: 1,
      snapshotId: "snapshot:resolved", at: T1 })).toBe(false);
    expect(await repository.finalizeResolvedServer({ serverInstanceId: "instance:lease-incarnation",
      workerId: "worker:stable", workerIncarnationId: "worker-incarnation:current", expectedVersion: 1,
      snapshotId: "snapshot:resolved", at: T1 })).toBe(true);
    expect(await repository.getServer("instance:lease-incarnation")).toMatchObject({
      status: "stopped",
      runtimeLeaseOwnerId: null,
      runtimeLeaseExpiresAt: null
    });
  });
});

const lease = (workerIncarnationId: string, now: string, expiresAt: string) => ({
  serverInstanceId: "instance:lease-incarnation",
  workerId: "worker:stable",
  workerIncarnationId,
  now,
  expiresAt
});

const register = (
  repository: ReturnType<typeof createInMemoryHostedControlPlaneRepository>,
  workerIncarnationId: string,
  startedAt: string,
  lastHeartbeatAt = startedAt
) => repository.writeWorkerHeartbeat({ workerId: "worker:stable", workerIncarnationId,
  region: "eu-central", startedAt, lastHeartbeatAt, buildSha: "test", status: "online" }, true);

const server = (overrides: Partial<HostedServerRecord> = {}): HostedServerRecord => ({
  serverInstanceId: "instance:lease-incarnation", mode: "free", displayName: "Lease", region: "eu-central",
  capacity: 20, status: "running", joinPolicy: "closed", provisioningState: "ready", worldSeed: "lease-seed",
  configVersion: 1, mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
  initialSnapshotId: "snapshot:initial", currentSnapshotId: "snapshot:initial", runtimeLeaseOwnerId: null,
  runtimeLeaseExpiresAt: null, lastWorkerHeartbeatAt: null, lastStartedAt: T0, lastPausedAt: null,
  lastStoppedAt: null, lastErrorCode: null, createdByAdminUserId: "admin:test", createdAt: T0, updatedAt: T0,
  version: 1, ...overrides
});
