import { describe, expect, it, vi } from "vitest";
import type { AdminAuditEntryView } from "@empire/shared-types";
import {
  createHostedRuntimeWorker,
  createInMemoryHostedControlPlaneRepository,
  type HostedControlPlaneRepository,
  type HostedJoinJobRecord,
  type HostedJoinReservationRecord,
  type HostedProvisioningJobRecord,
  type HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import type { ServerApp } from "../../apps/server/src/app";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import type { PostgresPlayerEntryRepository } from "../../apps/server/src/player-entry/postgres-player-entry-repository";
import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence/dto";
import { createInMemoryRuntimePersistenceRepositories } from "../../apps/server/src/runtime";

const T0 = new Date("2026-07-20T10:00:00.000Z");
const T1 = new Date("2026-07-20T10:01:00.000Z");
const MAP = { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 };

describe("hosted runtime worker recovery", () => {
  it("does not start another phase after drain is requested during an active phase", async () => {
    const base = createInMemoryHostedControlPlaneRepository();
    const heartbeatEntered = deferred<void>();
    const heartbeatGate = deferred<void>();
    const writeWorkerHeartbeat = vi.fn(async (
      input: Parameters<HostedControlPlaneRepository["writeWorkerHeartbeat"]>[0]
    ) => {
      heartbeatEntered.resolve();
      await heartbeatGate.promise;
      await base.writeWorkerHeartbeat(input);
    });
    const expireJoinReservations = vi.fn(base.expireJoinReservations);
    const controlPlane: HostedControlPlaneRepository = {
      ...base,
      writeWorkerHeartbeat,
      expireJoinReservations
    };
    const worker = hostedWorker(controlPlane, createServerApp({ clock: clock(() => T0) }), () => T0);

    const running = worker.runOnce();
    await heartbeatEntered.promise;
    worker.requestDrain();
    heartbeatGate.resolve();
    await running;

    expect(writeWorkerHeartbeat).toHaveBeenCalledTimes(1);
    expect(expireJoinReservations).not.toHaveBeenCalled();
  });

  it("runs tracked maintenance after gameplay work without delaying the worker cycle", async () => {
    const persistence = createInMemoryRuntimePersistenceRepositories();
    const maintenanceEntered = deferred<void>();
    const maintenanceGate = deferred<void>();
    const maintenance = vi.fn(async (nowIso: string) => {
      maintenanceEntered.resolve();
      await maintenanceGate.promise;
      return {
        acquired: true,
        deletedRows: 0,
        durationMs: 1,
        completedAt: nowIso
      };
    });
    persistence.snapshotMaintenance = {
      runIfDue: maintenance,
      runNow: maintenance,
      getHealth: () => ({
        lastStartedAt: null,
        lastCompletedAt: null,
        lastStatus: "never",
        lastDeletedRows: 0,
        lastDurationMs: 0,
        nextDueAt: null
      })
    };
    const events: string[] = [];
    const base = createInMemoryHostedControlPlaneRepository();
    const controlPlane: HostedControlPlaneRepository = {
      ...base,
      listServers: async () => {
        events.push("gameplay");
        return [];
      }
    };
    const app = createServerApp({
      clock: clock(() => T0),
      persistence
    });
    const worker = hostedWorker(controlPlane, app, () => T0);

    await expect(worker.runOnce()).resolves.toBeUndefined();
    await maintenanceEntered.promise;
    events.push("maintenance");
    expect(events).toEqual(["gameplay", "maintenance"]);

    await expect(worker.runOnce()).resolves.toBeUndefined();
    expect(maintenance).toHaveBeenCalledTimes(1);

    let stopped = false;
    const stopping = worker.stop().then(() => {
      stopped = true;
    });
    expect(stopped).toBe(false);
    maintenanceGate.resolve();
    await stopping;
    expect(stopped).toBe(true);
  });

  it("fails closed when a ready hosted server has no durable snapshot", async () => {
    const record = server("instance:ready-without-snapshot", {
      initialSnapshotId: "snapshot:missing",
      currentSnapshotId: "snapshot:missing"
    });
    const controlPlane = createInMemoryHostedControlPlaneRepository({ servers: [record] });
    const app = createServerApp({ clock: clock(() => T0) });
    const worker = hostedWorker(controlPlane, app, () => T0);

    await worker.heartbeat();
    await expect(worker.restoreKnownInstances()).resolves.toBeUndefined();

    expect(app.instanceManager.getInstanceById(record.serverInstanceId)).toBeUndefined();
    expect(await app.instanceManager.getPersistenceRepositories().snapshotRepository
      .loadLatest(record.serverInstanceId)).toBeNull();
    expect(await controlPlane.getServer(record.serverInstanceId)).toMatchObject({
      status: "running",
      lastErrorCode: null
    });
  });

  it("does not let one failed tick or failure heartbeat starve a later server", async () => {
    const first = server("instance:tick-fails");
    const second = server("instance:tick-continues");
    const app = createServerApp({ clock: clock(() => T0) });
    const firstSnapshot = await createSnapshot(app, first);
    const secondSnapshot = await createSnapshot(app, second);
    const base = createInMemoryHostedControlPlaneRepository({ servers: [
      withSnapshot(first, firstSnapshot),
      withSnapshot(second, secondSnapshot)
    ] });
    const heartbeat = vi.fn(async (input: Parameters<HostedControlPlaneRepository["writeInstanceHeartbeat"]>[0]) => {
      if (input.serverInstanceId === first.serverInstanceId && input.lastErrorCode) {
        throw new Error("Injected heartbeat write failure.");
      }
      await base.writeInstanceHeartbeat(input);
    });
    const controlPlane: HostedControlPlaneRepository = { ...base, writeInstanceHeartbeat: heartbeat };
    const originalTick = app.instanceManager.tickInstanceDurably.bind(app.instanceManager);
    const tick = vi.spyOn(app.instanceManager, "tickInstanceDurably").mockImplementation(async (
      instanceId,
      runtimeLeaseFence,
      tickOptions
    ) => {
      if (instanceId === first.serverInstanceId) {
        throw Object.assign(new Error("Injected tick failure."), { safeCode: "INJECTED_TICK_FAILURE" });
      }
      return originalTick(instanceId, runtimeLeaseFence, tickOptions);
    });

    await expect(hostedWorker(controlPlane, app, () => T0).runOnce()).resolves.toBeUndefined();

    expect(tick.mock.calls.map(([instanceId]) => instanceId)).toEqual([
      first.serverInstanceId,
      second.serverInstanceId
    ]);
    expect(app.instanceManager.getInstanceById(second.serverInstanceId)?.state.root.tick).toBe(1);
    expect(heartbeat).toHaveBeenCalledWith(expect.objectContaining({
      serverInstanceId: first.serverInstanceId,
      lastErrorCode: "INJECTED_TICK_FAILURE"
    }));
  });

  it("refreshes the runtime lease after recovery work before a fenced tick", async () => {
    const record = server("instance:tick-lease-refresh");
    const current = { value: T0 };
    const app = createServerApp({ clock: clock(() => current.value) });
    const snapshot = await createSnapshot(app, record);
    const controlPlane = createInMemoryHostedControlPlaneRepository({
      servers: [withSnapshot(record, snapshot)]
    });
    const recovery = app.instanceManager.getPersistenceRepositories().snapshotRepository;
    const loadForRecovery = recovery.loadForRecovery.bind(recovery);
    vi.spyOn(recovery, "loadForRecovery").mockImplementation(async (instanceId) => {
      const result = await loadForRecovery(instanceId);
      current.value = new Date(T0.getTime() + 19_000);
      return result;
    });
    const acquireRuntimeLease = vi.spyOn(controlPlane, "acquireRuntimeLease");

    await hostedWorker(controlPlane, app, () => current.value).runOnce();

    expect(acquireRuntimeLease).toHaveBeenCalledTimes(2);
    expect(acquireRuntimeLease.mock.calls[0]?.[0]).toMatchObject({
      now: T0.toISOString(),
      expiresAt: new Date(T0.getTime() + 20_000).toISOString()
    });
    expect(acquireRuntimeLease.mock.calls[1]?.[0]).toMatchObject({
      now: new Date(T0.getTime() + 19_000).toISOString(),
      expiresAt: new Date(T0.getTime() + 39_000).toISOString()
    });
    expect(app.instanceManager.getInstanceById(record.serverInstanceId)?.state.root.tick).toBe(1);
  });

  it("restores an unchanged lobby runtime once instead of rehydrating it every worker cycle", async () => {
    const baseRecord = server("instance:lobby-restore-once", {
      status: "lobby",
      joinPolicy: "open"
    });
    const app = createServerApp({ clock: clock(() => T0) });
    const snapshot = await createSnapshot(app, baseRecord);
    app.instanceManager.destroyInstance(baseRecord.serverInstanceId);
    const record = withSnapshot(baseRecord, snapshot);
    const controlPlane = createInMemoryHostedControlPlaneRepository({ servers: [record] });
    const repository = app.instanceManager.getPersistenceRepositories().snapshotRepository;
    const loadForRecovery = vi.spyOn(repository, "loadForRecovery");
    const worker = hostedWorker(controlPlane, app, () => T0);

    await worker.restoreKnownInstances();
    await worker.runOnce();
    await worker.runOnce();

    expect(loadForRecovery).toHaveBeenCalledTimes(1);
    expect(app.instanceManager.getInstanceById(record.serverInstanceId)?.state.root)
      .toEqual(snapshot.state.root);
  });

  it.each([
    {
      name: "before the registration deadline",
      registrationClosesAt: new Date(T0.getTime() + 30 * 60_000).toISOString(),
      registrationClosedAt: null
    },
    {
      name: "after registration is already frozen",
      registrationClosesAt: new Date(T0.getTime() - 30 * 60_000).toISOString(),
      registrationClosedAt: new Date(T0.getTime() - 30 * 60_000).toISOString()
    }
  ])("does not lock registration lifecycle $name", async ({ registrationClosesAt, registrationClosedAt }) => {
    const record = server(`instance:registration-freeze-skip:${registrationClosedAt ?? "future"}`, {
      registrationClosesAt,
      registrationClosedAt
    });
    const app = createServerApp({ clock: clock(() => T0) });
    const snapshot = await createSnapshot(app, record);
    const base = createInMemoryHostedControlPlaneRepository({ servers: [withSnapshot(record, snapshot)] });
    const freezeRegistrationLifecycle = vi.fn(base.freezeRegistrationLifecycle);
    const controlPlane: HostedControlPlaneRepository = { ...base, freezeRegistrationLifecycle };

    await hostedWorker(controlPlane, app, () => T0).runOnce();

    expect(freezeRegistrationLifecycle).not.toHaveBeenCalled();
  });

  it("freezes registration once its deadline is due", async () => {
    const record = server("instance:registration-freeze-due", {
      registrationClosesAt: T0.toISOString(),
      registrationClosedAt: null
    });
    const app = createServerApp({ clock: clock(() => T0) });
    const snapshot = await createSnapshot(app, record);
    const base = createInMemoryHostedControlPlaneRepository({ servers: [withSnapshot(record, snapshot)] });
    const freezeRegistrationLifecycle = vi.fn(base.freezeRegistrationLifecycle);
    const controlPlane: HostedControlPlaneRepository = { ...base, freezeRegistrationLifecycle };

    await hostedWorker(controlPlane, app, () => T0).runOnce();

    expect(freezeRegistrationLifecycle).toHaveBeenCalledOnce();
    expect(await controlPlane.getServer(record.serverInstanceId)).toMatchObject({
      registrationClosedAt: T0.toISOString(),
      joinPolicy: "closed"
    });
  });

  it("leaves dormant lobby runtimes cold until an action or player job needs them", async () => {
    const baseRecord = server("instance:dormant-lobby", {
      status: "lobby",
      joinPolicy: "closed",
      registrationScheduleVersion: 0,
      registrationOpensAt: null,
      registrationClosesAt: null,
      registrationClosedAt: null
    });
    const app = createServerApp({ clock: clock(() => T0) });
    const snapshot = await createSnapshot(app, baseRecord);
    app.instanceManager.destroyInstance(baseRecord.serverInstanceId);
    const record = withSnapshot(baseRecord, snapshot);
    const controlPlane = createInMemoryHostedControlPlaneRepository({ servers: [record] });
    const repository = app.instanceManager.getPersistenceRepositories().snapshotRepository;
    const loadForRecovery = vi.spyOn(repository, "loadForRecovery");
    const worker = hostedWorker(controlPlane, app, () => T0);

    await worker.restoreKnownInstances();
    await worker.runOnce();

    expect(loadForRecovery).not.toHaveBeenCalled();
    expect(app.instanceManager.getInstanceById(record.serverInstanceId)).toBeUndefined();
    expect(await controlPlane.getServer(record.serverInstanceId)).toMatchObject({
      runtimeLeaseOwnerId: null,
      runtimeLeaseExpiresAt: null
    });
  });

  it("keeps a resolved server retryable until membership sync succeeds, then closes it", async () => {
    const record = server("instance:resolved", { joinPolicy: "open" });
    const app = createServerApp({ clock: clock(() => T0) });
    const snapshot = await createSnapshot(app, record, (runtime) => {
      runtime.state.root = {
        ...runtime.state.root,
        phase: "resolved",
        version: runtime.state.root.version + 1
      };
      runtime.state.matchResult = {
        id: `match:${record.serverInstanceId}`,
        serverInstanceId: record.serverInstanceId,
        endedAt: T0.toISOString(),
        winnerPlayerId: null,
        winnerAllianceId: null,
        ranking: [],
        reason: "final_lockdown_score"
      };
    });
    const controlPlane = createInMemoryHostedControlPlaneRepository({
      servers: [withSnapshot(record, snapshot)]
    });
    const syncResolvedMemberships = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Injected membership sync failure."), {
        safeCode: "MEMBERSHIP_SYNC_FAILED"
      }))
      .mockResolvedValue(undefined);
    const playerEntry = {
      claimMembershipJob: async () => null,
      syncResolvedMemberships
    } as unknown as PostgresPlayerEntryRepository;
    const worker = hostedWorker(controlPlane, app, () => T0, playerEntry);

    await worker.runOnce();
    expect(await controlPlane.getServer(record.serverInstanceId)).toMatchObject({
      status: "running",
      joinPolicy: "open",
      lastErrorCode: null
    });

    await worker.runOnce();
    expect(syncResolvedMemberships).toHaveBeenCalledTimes(2);
    expect(await controlPlane.getServer(record.serverInstanceId)).toMatchObject({
      status: "stopped",
      joinPolicy: "closed",
      currentSnapshotId: snapshot.snapshotId,
      runtimeLeaseOwnerId: null,
      runtimeLeaseExpiresAt: null,
      lastErrorCode: null
    });
    expect(app.instanceManager.getInstanceById(record.serverInstanceId)).toMatchObject({
      record: { status: "stopped" },
      lobby: { joinPolicy: "closed" },
      scheduler: { isRunning: false }
    });
  });

  it("persists a partial map repair before completing an existing-player join", async () => {
    const baseRecord = server("instance:join-map-repair", {
      status: "lobby",
      joinPolicy: "open"
    });
    const app = createServerApp({ clock: clock(() => T0) });
    const accountId = "account:join-map-repair";
    const registration = await app.gameplaySessionService.getOrCreateRegistration({
      accountId,
      serverInstanceId: baseRecord.serverInstanceId,
      nowIso: T0.toISOString()
    });
    let missingDistrictId = "";
    const snapshot = await createSnapshot(app, baseRecord, (runtime) => {
      const membership = ensureGameplaySliceMembershipInState(runtime.state, {
        serverInstanceId: baseRecord.serverInstanceId,
        playerId: registration.playerId,
        factionId: "mafian",
        mode: "free"
      });
      if (!membership.accepted) throw new Error("Failed to create the existing-player fixture.");
      runtime.state = membership.state;
      missingDistrictId = runtime.state.root.districtIds[0]!;
      delete runtime.state.districtsById[missingDistrictId];
    });
    const record = withSnapshot(baseRecord, snapshot);
    const controlPlane = createInMemoryHostedControlPlaneRepository({ servers: [record] });
    const reservation = joinReservation(record, accountId);
    const job = joinJob(record, reservation);
    expect(await controlPlane.reserveJoinTransaction({ reservation, job })).toMatchObject({ kind: "created" });

    await hostedWorker(controlPlane, app, () => T0).runOnce();

    const latest = await app.instanceManager.getPersistenceRepositories().snapshotRepository
      .loadLatest(record.serverInstanceId);
    expect(latest?.state.districtsById[missingDistrictId]).toBeDefined();
    expect(latest?.integrity.rootVersion).toBe(snapshot.integrity.rootVersion + 1);
    expect(await controlPlane.getJoinReservation(reservation.reservationId)).toMatchObject({
      status: "committed",
      joinTicketId: expect.any(String)
    });
  });

  it("reuses an existing initial snapshot when provisioning is reclaimed after a crash", async () => {
    const record = server("instance:provisioning-retry", {
      status: "requested",
      joinPolicy: "closed",
      provisioningState: "requested",
      initialSnapshotId: null,
      currentSnapshotId: null
    });
    const job = provisioningJob(record.serverInstanceId);
    const controlPlane = createInMemoryHostedControlPlaneRepository();
    await controlPlane.createServerTransaction({
      server: record,
      job,
      adminUserId: record.createdByAdminUserId,
      idempotencyKey: "test-provisioning-retry-key",
      requestHash: "test-provisioning-retry-hash",
      audit: audit("create-server-request", T0)
    });
    await controlPlane.writeWorkerHeartbeat({ workerId: "worker:stale",
      workerIncarnationId: "worker-incarnation:stale", region: "eu-central", buildSha: "test",
      startedAt: T0.toISOString(), lastHeartbeatAt: T0.toISOString(), status: "online" }, true);
    const staleClaim = await controlPlane.claimProvisioningJob("worker:stale", "worker-incarnation:stale",
      T0.toISOString(), T1.toISOString());
    if (!staleClaim) throw new Error("Expected the first provisioning claim.");
    expect(await controlPlane.acquireRuntimeLease({
      serverInstanceId: record.serverInstanceId,
      workerId: "worker:stale",
      workerIncarnationId: "worker-incarnation:stale",
      now: T0.toISOString(),
      expiresAt: T1.toISOString()
    })).toBe(true);
    expect(await controlPlane.beginProvisioning({
      jobId: staleClaim.jobId,
      serverInstanceId: record.serverInstanceId,
      workerId: "worker:stale",
      workerIncarnationId: "worker-incarnation:stale",
      expectedJobVersion: staleClaim.version,
      at: T0.toISOString()
    })).toBe(true);

    const appBeforeCrash = createServerApp({ clock: clock(() => T0) });
    const provisioningRecord = await controlPlane.getServer(record.serverInstanceId);
    if (!provisioningRecord) throw new Error("Expected the provisioning server record.");
    const initialSnapshot = await createSnapshot(appBeforeCrash, provisioningRecord);
    const persistence = appBeforeCrash.instanceManager.getPersistenceRepositories();
    const save = vi.spyOn(persistence.snapshotRepository, "saveRecoveryHead");
    const current = { value: new Date(T1.getTime() + 1_000) };
    const appAfterCrash = createServerApp({ persistence, clock: clock(() => current.value) });

    await hostedWorker(controlPlane, appAfterCrash, () => current.value, undefined, "worker:recovery").runOnce();

    expect(save).not.toHaveBeenCalled();
    expect(await controlPlane.getServer(record.serverInstanceId)).toMatchObject({
      status: "lobby",
      provisioningState: "ready",
      initialSnapshotId: initialSnapshot.snapshotId,
      currentSnapshotId: initialSnapshot.snapshotId
    });
    const restored = appAfterCrash.instanceManager.getInstanceById(record.serverInstanceId);
    expect(restored?.state.root).toEqual(initialSnapshot.state.root);
    expect(restored?.state.serverInstance.worldSeed).toBe(initialSnapshot.state.serverInstance.worldSeed);
    expect(Object.keys(restored?.state.districtsById ?? {}))
      .toEqual(Object.keys(initialSnapshot.state.districtsById));
  });
});

const hostedWorker = (
  controlPlane: HostedControlPlaneRepository,
  app: ServerApp,
  now: () => Date,
  playerEntry?: PostgresPlayerEntryRepository,
  workerId = "worker:test"
) => createHostedRuntimeWorker({
  workerId,
  region: "eu-central",
  buildSha: "test",
  controlPlane,
  server: app,
  playerEntry,
  now
});

const createSnapshot = async (
  app: ServerApp,
  record: HostedServerRecord,
  mutate?: (runtime: NonNullable<ReturnType<ServerApp["instanceManager"]["getInstanceById"]>>) => void
): Promise<InstanceSnapshotDto> => {
  const created = app.serverInstanceCreationService.createGameServerInstanceResult({
    serverInstanceId: record.serverInstanceId,
    mode: record.mode,
    displayName: record.displayName,
    region: record.region,
    capacity: record.capacity,
    mapComposition: record.mapComposition as never,
    joinPolicy: record.joinPolicy === "open" ? "open" : "closed",
    worldSeed: record.worldSeed
  });
  if (!created.accepted) throw new Error("Failed to create the hosted runtime fixture.");
  mutate?.(created.runtime);
  await app.instanceManager.saveInstanceSnapshot(record.serverInstanceId);
  const snapshot = await app.instanceManager.getPersistenceRepositories().snapshotRepository
    .loadLatest(record.serverInstanceId);
  if (!snapshot) throw new Error("Failed to save the hosted runtime fixture snapshot.");
  return snapshot;
};

const withSnapshot = (record: HostedServerRecord, snapshot: InstanceSnapshotDto): HostedServerRecord => ({
  ...record,
  initialSnapshotId: snapshot.snapshotId,
  currentSnapshotId: snapshot.snapshotId
});

const server = (serverInstanceId: string, overrides: Partial<HostedServerRecord> = {}): HostedServerRecord => Object.assign({
  serverInstanceId,
  mode: "free",
  serverTemplate: "full",
  displayName: serverInstanceId,
  region: "eu-central",
  capacity: 20,
  status: "running",
  joinPolicy: "open",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 2,
  registrationWindowMinutes: 60,
  registrationScheduleVersion: 1,
  registrationOpensAt: new Date(T0.getTime() - 30 * 60_000).toISOString(),
  registrationClosesAt: new Date(T0.getTime() + 30 * 60_000).toISOString(),
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: 8,
  canonicalFirstEliminationTick: 5_760,
  canonicalTickRateMs: 5_000,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  worldSeed: `seed:${serverInstanceId}`,
  configVersion: 1,
  mapComposition: MAP,
  initialSnapshotId: null,
  currentSnapshotId: null,
  runtimeLeaseOwnerId: null,
  runtimeLeaseExpiresAt: null,
  lastWorkerHeartbeatAt: null,
  lastStartedAt: T0.toISOString(),
  lastPausedAt: null,
  lastStoppedAt: null,
  lastErrorCode: null,
  createdByAdminUserId: "admin:test",
  createdAt: T0.toISOString(),
  updatedAt: T0.toISOString(),
  version: 1
} satisfies HostedServerRecord, overrides);

const provisioningJob = (serverInstanceId: string): HostedProvisioningJobRecord => ({
  jobId: `provisioning-job:${serverInstanceId}`,
  serverInstanceId,
  attempt: 0,
  status: "pending",
  availableAt: T0.toISOString(),
  claimedByWorkerId: null,
  claimedUntil: null,
  lastErrorCode: null,
  createdAt: T0.toISOString(),
  updatedAt: T0.toISOString(),
  version: 1
});

const joinReservation = (
  record: HostedServerRecord,
  playerIdentityId: string
): HostedJoinReservationRecord => ({
  reservationId: `reservation:${record.serverInstanceId}`,
  serverInstanceId: record.serverInstanceId,
  playerIdentityId,
  status: "reserved",
  idempotencyKey: `join:${record.serverInstanceId}`,
  requestHash: `hash:${record.serverInstanceId}`,
  expectedServerVersion: record.version,
  reservedSlot: 1,
  factionId: "mafian",
  joinTicketId: null,
  expiresAt: new Date(T1.getTime() + 60_000).toISOString(),
  createdAt: T0.toISOString(),
  committedAt: null,
  canceledAt: null,
  updatedAt: T0.toISOString(),
  version: 1
});

const joinJob = (
  record: HostedServerRecord,
  reservation: HostedJoinReservationRecord
): HostedJoinJobRecord => ({
  jobId: `join-job:${record.serverInstanceId}`,
  reservationId: reservation.reservationId,
  serverInstanceId: record.serverInstanceId,
  status: "pending",
  attempt: 0,
  availableAt: T0.toISOString(),
  claimedByWorkerId: null,
  claimedByWorkerIncarnationId: null,
  claimedUntil: null,
  lastErrorCode: null,
  createdAt: T0.toISOString(),
  updatedAt: T0.toISOString(),
  version: 1
});

const audit = (action: AdminAuditEntryView["action"], at: Date): AdminAuditEntryView => ({
  id: `audit:${action}`,
  adminSessionId: null,
  actorId: "admin:test",
  role: "owner",
  action,
  targetInstanceId: null,
  result: "success",
  correlationId: `correlation:${action}`,
  createdAt: at.toISOString()
});

const clock = (now: () => Date) => ({
  now: () => new Date(now().getTime()),
  nowIso: () => now().toISOString()
});

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
};
