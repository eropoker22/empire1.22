import { describe, expect, it } from "vitest";
import type { AdminAuditEntryView } from "@empire/shared-types";
import { createInMemoryHostedControlPlaneRepository } from
  "../../apps/server/src/admin/hosted/in-memory-hosted-control-plane-repository";
import type { HostedActionRequestRecord, HostedReadyMembershipRecord, HostedServerRecord } from
  "../../apps/server/src/admin/hosted/hosted-control-plane-repository";

const NOW = "2026-07-20T16:00:00.000Z";
const LEASE_END = "2026-07-20T18:00:00.000Z";
const WORKER_ID = "worker:lifecycle";
const INCARNATION_ID = "worker-incarnation:lifecycle";

describe("in-memory hosted registration lifecycle actions", () => {
  it("opens for exactly one hour, starts at two ready players, and keeps joins open", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({
      servers: [server()],
      readyMembershipsByServerId: { "instance:lifecycle": readyMemberships(2) }
    });
    await prepareWorker(repository);
    expect(await complete(repository, "open-registration-now", 1)).toBe(true);
    expect(await repository.getServer("instance:lifecycle")).toMatchObject({
      registrationOpensAt: NOW,
      registrationClosesAt: "2026-07-20T17:00:00.000Z",
      joinPolicy: "open",
      version: 2
    });

    expect(await complete(repository, "start", 2)).toBe(true);
    expect(await repository.getServer("instance:lifecycle")).toMatchObject({
      status: "running",
      joinPolicy: "open",
      lastStartedAt: NOW,
      version: 3
    });
  });

  it("rejects start when only one durable membership is ready", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({
      servers: [server({ registrationOpensAt: NOW, registrationClosesAt: "2026-07-20T17:00:00.000Z",
        registrationScheduleVersion: 1, joinPolicy: "open" })],
      readyMembershipsByServerId: { "instance:lifecycle": readyMemberships(1) }
    });
    await prepareWorker(repository);
    expect(await complete(repository, "start", 1)).toBe(false);
    expect(await repository.getServer("instance:lifecycle")).toMatchObject({
      status: "lobby",
      version: 1,
      lastErrorCode: "SERVER_START_MINIMUM_PLAYERS_NOT_MET"
    });
  });

  it("emergency close preserves closesAt and freezes the low-player pacing", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({
      servers: [server({ registrationOpensAt: NOW, registrationClosesAt: "2026-07-20T17:00:00.000Z",
        registrationScheduleVersion: 1, joinPolicy: "open" })],
      readyMembershipsByServerId: { "instance:lifecycle": readyMemberships(2) }
    });
    await prepareWorker(repository);
    const closeAt = "2026-07-20T16:30:00.000Z";
    expect(await complete(repository, "close-registration-now", 1, closeAt)).toBe(true);
    expect(await repository.getServer("instance:lifecycle")).toMatchObject({
      registrationClosesAt: "2026-07-20T17:00:00.000Z",
      registrationClosedAt: closeAt,
      registrationBaselinePlayers: 2,
      effectiveFinalLockdownTrigger: 1,
      joinPolicy: "closed"
    });
  });
});

type Repository = ReturnType<typeof createInMemoryHostedControlPlaneRepository>;

const prepareWorker = async (repository: Repository): Promise<void> => {
  await repository.writeWorkerHeartbeat({ workerId: WORKER_ID, workerIncarnationId: INCARNATION_ID,
    region: "eu-central", startedAt: NOW, lastHeartbeatAt: NOW, buildSha: "test", status: "online" }, true);
  expect(await repository.acquireRuntimeLease({ serverInstanceId: "instance:lifecycle", workerId: WORKER_ID,
    workerIncarnationId: INCARNATION_ID, now: NOW, expiresAt: LEASE_END })).toBe(true);
};

const complete = async (
  repository: Repository,
  actionName: HostedActionRequestRecord["action"],
  expectedVersion: number,
  at = NOW
): Promise<boolean> => {
  const request = action(actionName, expectedVersion, at);
  expect((await repository.enqueueActionTransaction({ request, idempotencyKey: `key:${actionName}:${expectedVersion}`,
    requestHash: `hash:${actionName}:${expectedVersion}`, audit: audit("lifecycle-request", at) })).kind).toBe("created");
  await repository.writeWorkerHeartbeat({ workerId: WORKER_ID, workerIncarnationId: INCARNATION_ID,
    region: "eu-central", startedAt: NOW, lastHeartbeatAt: at, buildSha: "test", status: "online" });
  const claimed = await repository.claimAction(WORKER_ID, INCARNATION_ID, at, LEASE_END);
  if (!claimed) throw new Error("Expected lifecycle action claim.");
  return repository.completeAction({ request: claimed, workerIncarnationId: INCARNATION_ID,
    nextStatus: actionName === "start" ? "running" : "lobby",
    nextJoinPolicy: actionName === "open-registration-now" ? "open" : "closed",
    at,
    audit: audit("lifecycle-success", at) });
};

const action = (
  actionName: HostedActionRequestRecord["action"],
  expectedVersion: number,
  at: string
): HostedActionRequestRecord => ({
  actionRequestId: `action:${actionName}:${expectedVersion}`,
  serverInstanceId: "instance:lifecycle",
  adminUserId: "admin:owner",
  action: actionName,
  actionPayload: {},
  reason: "Test lifecycle action.",
  expectedVersion,
  status: "requested",
  claimedByWorkerId: null,
  claimedUntil: null,
  lastErrorCode: null,
  createdAt: at,
  updatedAt: at,
  version: 1
});

const readyMemberships = (count: number): HostedReadyMembershipRecord[] => Array.from({ length: count }, (_, index) => ({
  membershipId: `membership:${index + 1}`,
  playerId: `player:${index + 1}`,
  reservedSpawnDistrictId: `district:${index + 1}`
}));

const audit = (action: AdminAuditEntryView["action"], at: string): AdminAuditEntryView => ({
  id: `audit:${action}:${at}`, adminSessionId: null, actorId: WORKER_ID, role: null, action,
  targetInstanceId: "instance:lifecycle", result: "success", correlationId: `correlation:${action}`, createdAt: at
});

const server = (overrides: Partial<HostedServerRecord> = {}): HostedServerRecord => ({
  serverInstanceId: "instance:lifecycle", mode: "free", serverTemplate: "full", displayName: "Lifecycle",
  region: "eu-central", capacity: 20, status: "lobby", joinPolicy: "closed", provisioningState: "ready",
  minimumReadyPlayersToStart: 2, registrationWindowMinutes: 60, registrationScheduleVersion: 0,
  registrationOpensAt: null, registrationClosesAt: null, registrationClosedAt: null,
  registrationBaselinePlayers: null, canonicalFinalLockdownTrigger: 8, canonicalFirstEliminationTick: 5_760,
  canonicalTickRateMs: 5_000, effectiveFinalLockdownTrigger: null, effectiveFirstEliminationTick: null,
  worldSeed: "lifecycle-seed", configVersion: 1,
  mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
  initialSnapshotId: "snapshot:initial", currentSnapshotId: "snapshot:initial", runtimeLeaseOwnerId: null,
  runtimeLeaseExpiresAt: null, lastWorkerHeartbeatAt: null, lastStartedAt: null, lastPausedAt: null,
  lastStoppedAt: null, lastErrorCode: null, createdByAdminUserId: "admin:owner", createdAt: NOW,
  updatedAt: NOW, version: 1, ...overrides
});
