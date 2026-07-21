import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { handleSelectSpawnDistrict } from "@empire/game-core";
import type { AdminCreateServerRequestView, AdminSessionView } from "@empire/shared-types";
import { createHostedControlPlaneService, createHostedRuntimeWorker } from "../../apps/server/src/admin/hosted";
import type { InMemoryHostedControlPlaneRepository } from "../../apps/server/src/admin/hosted/in-memory-hosted-control-plane-repository";
import { createInMemoryAdminDurableRepositories } from "../../apps/server/src/admin/read-only";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { findSharedCitySpawnCandidate } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";

const NOW = new Date("2026-07-16T10:00:00.000Z");
const FLAGS = { NODE_ENV: "test", EMPIRE_ADMIN_WRITES_ENABLED: "true", EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true", EMPIRE_SERVER_PROVISIONING_ENABLED: "true" };
const owner = session("owner");
const validRequest: AdminCreateServerRequestView = {
  mode: "free", serverTemplate: "full", displayName: "Hosted Test", region: "eu-central", capacity: 20, joinPolicy: "closed",
  mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 }
};

describe("hosted server control plane", () => {
  it("creates one durable request and replays the same idempotency key", async () => {
    const { repositories, service } = await setup();
    const key = "test-create-server-key-0001";
    const first = await service.createServer({ session: owner, payload: validRequest, idempotencyKey: key, correlationId: "request:1" });
    const replay = await service.createServer({ session: owner, payload: validRequest, idempotencyKey: key, correlationId: "request:2" });
    const conflict = await service.createServer({ session: owner, payload: { ...validRequest, displayName: "Different" }, idempotencyKey: key, correlationId: "request:3" });
    expect(first.accepted && first.data.replayed).toBe(false);
    expect(replay.accepted && replay.data.replayed).toBe(true);
    expect(first.accepted && replay.accepted && replay.data.server.serverInstanceId).toBe(first.accepted ? first.data.server.serverInstanceId : "");
    expect(conflict.accepted).toBe(false);
    expect(await repositories.hosted.listServers()).toHaveLength(1);
  });

  it("fails closed for roles, flags, regions, capacity and non-canonical maps", async () => {
    const { service } = await setup();
    expect((await service.createServer({ session: session("viewer"), payload: validRequest, idempotencyKey: "test-create-viewer-0001", correlationId: "r" })).accepted).toBe(false);
    expect((await service.createServer({ session: owner, payload: { ...validRequest, region: "unknown" }, idempotencyKey: "test-create-region-0001", correlationId: "r" })).accepted).toBe(false);
    expect((await service.createServer({ session: owner, payload: { ...validRequest, capacity: 21 }, idempotencyKey: "test-create-capacity-001", correlationId: "r" })).accepted).toBe(false);
    const finalLockdownCapacity = resolveModeConfig("free").balance.finalLockdown!.triggerActivePlayers;
    expect((await service.createServer({ session: owner, payload: { ...validRequest, capacity: finalLockdownCapacity },
      idempotencyKey: "test-create-lockdown-capacity", correlationId: "r" })).errors[0]?.code).toBe("ADMIN_CAPACITY_INVALID");
    expect((await service.createServer({ session: owner, payload: { ...validRequest, joinPolicy: "open" }, idempotencyKey: "test-create-open-policy1", correlationId: "r" })).errors[0]?.code).toBe("ADMIN_JOIN_POLICY_INVALID");
    expect((await service.createServer({ session: owner, payload: { ...validRequest, joinPolicy: "invite_only" }, idempotencyKey: "test-create-invite-policy", correlationId: "r" })).errors[0]?.code).toBe("ADMIN_JOIN_POLICY_INVALID");
    expect((await service.createServer({ session: owner, payload: { ...validRequest, mapComposition: { ...validRequest.mapComposition, downtown: 7, park: 38 } }, idempotencyKey: "test-create-map-invalid1", correlationId: "r" })).accepted).toBe(false);
    expect((await service.createServer({ session: owner, payload: { ...validRequest, registrationClosesAt: NOW.toISOString() },
      idempotencyKey: "test-create-browser-close", correlationId: "r" })).errors[0]?.code).toBe("ADMIN_CREATE_INVALID");
    const repositories = createInMemoryAdminDurableRepositories();
    const disabled = createHostedControlPlaneService({ repositories, environment: { NODE_ENV: "test" }, allowInMemoryForTests: true });
    expect((await disabled.createServer({ session: owner, payload: validRequest, idempotencyKey: "test-create-disabled-001", correlationId: "r" })).errors[0]?.code).toBe("ADMIN_WRITES_DISABLED");
  });

  it("snapshots the explicit control/full template without exposing elimination balance", async () => {
    const { repositories, service } = await setup();
    const control = await service.createServer({ session: owner,
      payload: { ...validRequest, serverTemplate: "control", capacity: 2 },
      idempotencyKey: "test-create-control-template", correlationId: "control" });
    expect(control.accepted).toBe(true);
    if (!control.accepted) return;
    expect(await repositories.hosted.getServer(control.data.server.serverInstanceId)).toMatchObject({
      serverTemplate: "control",
      capacity: 2,
      minimumReadyPlayersToStart: 2,
      registrationWindowMinutes: 60,
      canonicalFirstEliminationTick: null,
      canonicalTickRateMs: null
    });
    expect((await service.createServer({ session: owner,
      payload: { ...validRequest, serverTemplate: "full", capacity: 2 },
      idempotencyKey: "test-create-full-small", correlationId: "full" })).errors[0]?.code)
      .toBe("ADMIN_CAPACITY_INVALID");
  });

  it("provisions exactly one initial snapshot and exposes durable lobby state", async () => {
    const { repositories, service } = await setup();
    const created = await service.createServer({ session: owner, payload: validRequest, idempotencyKey: "test-provision-server-001", correlationId: "request:1" });
    expect(created.accepted).toBe(true);
    if (!created.accepted) return;
    const serverApp = createServerApp();
    const worker = createHostedRuntimeWorker({ workerId: "worker:test", region: "eu-central", buildSha: "test",
      controlPlane: repositories.hosted, server: serverApp, now: () => NOW });
    await worker.runOnce();
    const record = await repositories.hosted.getServer(created.data.server.serverInstanceId);
    const snapshot = await serverApp.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(created.data.server.serverInstanceId);
    expect(record).toMatchObject({ status: "lobby", provisioningState: "ready", joinPolicy: "closed" });
    expect(record?.initialSnapshotId).toBe(snapshot?.snapshotId);
    expect(snapshot?.tick).toBe(0);
    expect(snapshot?.state.root.playerIds).toEqual([]);
    expect(Object.keys(snapshot?.state.districtsById ?? {})).toHaveLength(161);
    await worker.runOnce();
    expect((await repositories.hosted.getServer(created.data.server.serverInstanceId))?.initialSnapshotId).toBe(snapshot?.snapshotId);
  });

  it("serializes concurrent start requests behind one active lifecycle operation", async () => {
    const { repositories, service } = await setup();
    const created = await service.createServer({ session: owner, payload: validRequest,
      idempotencyKey: "test-concurrent-start-create", correlationId: "request:create" });
    if (!created.accepted) throw new Error("fixture create failed");
    const worker = createHostedRuntimeWorker({ workerId: "worker:test", region: "eu-central", buildSha: "test",
      controlPlane: repositories.hosted, server: createServerApp(), now: () => NOW });
    await worker.runOnce();
    const record = await repositories.hosted.getServer(created.data.server.serverInstanceId);
    if (!record) throw new Error("fixture server missing");
    const results = await Promise.all(["a", "b"].map((suffix) => service.requestAction({
      session: owner,
      serverInstanceId: record.serverInstanceId,
      payload: { action: "start", expectedVersion: record.version, reason: `Concurrent start ${suffix}` },
      idempotencyKey: `test-concurrent-start-${suffix}`,
      correlationId: `request:start:${suffix}`
    })));
    expect(results.filter((result) => result.accepted)).toHaveLength(1);
    expect(results.find((result) => !result.accepted)?.errors[0]?.code)
      .toBe("SERVER_LIFECYCLE_OPERATION_ACTIVE");
  });

  it("uses exclusive leases and restores the same state across lifecycle restart", async () => {
    const { repositories, service } = await setup();
    const created = await service.createServer({ session: owner, payload: validRequest, idempotencyKey: "test-lifecycle-server-01", correlationId: "request:1" });
    if (!created.accepted) throw new Error("fixture create failed");
    const app = createServerApp();
    const worker = createHostedRuntimeWorker({ workerId: "worker:A", region: "eu-central", buildSha: "test", controlPlane: repositories.hosted, server: app, now: () => NOW });
    await worker.runOnce();
    const id = created.data.server.serverInstanceId;
    expect(await repositories.hosted.acquireRuntimeLease({ serverInstanceId: id, workerId: "worker:B",
      workerIncarnationId: "worker-incarnation:B", now: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + 20_000).toISOString() })).toBe(false);
    let record = (await repositories.hosted.getServer(id))!;
    await service.requestAction({ session: owner, serverInstanceId: id,
      payload: { action: "open-registration-now", expectedVersion: record.version, reason: "Open integration registration" },
      idempotencyKey: "test-action-open-now-001", correlationId: "request:open" });
    await worker.runOnce();
    record = (await repositories.hosted.getServer(id))!;
    const before = app.instanceManager.getInstanceById(id)!;
    const worldSeed = before.state.serverInstance.worldSeed;
    const districtIds = [...before.state.root.districtIds];
    const minimumActivePlayers = record.minimumReadyPlayersToStart;
    const readyMemberships: Array<{ membershipId: string; playerId: string; reservedSpawnDistrictId: string }> = [];
    for (let index = 0; index < minimumActivePlayers; index += 1) {
      const playerId = `player:lifecycle:${index + 1}`;
      const membership = ensureGameplaySliceMembershipInState(before.state, {
        serverInstanceId: id,
        playerId,
        factionId: "mafian",
        mode: "free"
      });
      if (!membership.accepted) throw new Error("fixture membership failed");
      before.state = membership.state;
      const player = before.state.playersById[playerId]!;
      const membershipId = `membership:lifecycle:${index + 1}`;
      before.state.playersById[playerId] = { ...player, accountId: `account:lifecycle:${index + 1}`,
        metadata: { ...(player.metadata ?? {}), membershipId, setupComplete: true, starterPackageApplied: true } };
      const reservedSpawnDistrictId = before.state.root.districtIds.find((districtId) =>
        findSharedCitySpawnCandidate(districtId)?.enabled && !before.state.districtsById[districtId]?.ownerPlayerId);
      if (!reservedSpawnDistrictId) throw new Error("fixture spawn district missing");
      const spawned = handleSelectSpawnDistrict(before.state, {
        id: `command:test-spawn:${index + 1}`, type: "select-spawn-district", mode: "free",
        serverInstanceId: id, playerId, clientRequestId: `test-spawn:${index + 1}`,
        issuedAt: NOW.toISOString(), payload: { districtId: reservedSpawnDistrictId }
      }, { config: before.config, clock: before.clock,
        mapRules: { isEnabledSpawnCandidate: (districtId) => Boolean(findSharedCitySpawnCandidate(districtId)?.enabled) } });
      if (spawned.errors.length) throw new Error(`fixture spawn failed: ${spawned.errors[0]?.code}`);
      before.state = spawned.nextState;
      readyMemberships.push({ membershipId, playerId, reservedSpawnDistrictId });
    }
    let visibleReadyMemberships = readyMemberships.slice(0, 1);
    const hostedRepository = repositories.hosted as InMemoryHostedControlPlaneRepository;
    hostedRepository.setReadyMembershipsForTests(id, visibleReadyMemberships);
    await app.instanceManager.saveInstanceSnapshot(id);
    await service.requestAction({ session: owner, serverInstanceId: id,
      payload: { action: "start", expectedVersion: record.version, reason: "Reject one player start" },
      idempotencyKey: "test-action-start-one-01", correlationId: "request:one" });
    await worker.runOnce();
    record = (await repositories.hosted.getServer(id))!;
    expect(record).toMatchObject({ status: "lobby", lastErrorCode: "SERVER_START_MINIMUM_PLAYERS_NOT_MET" });
    visibleReadyMemberships = readyMemberships;
    hostedRepository.setReadyMembershipsForTests(id, visibleReadyMemberships);
    await service.requestAction({ session: owner, serverInstanceId: id, payload: { action: "start", expectedVersion: record.version, reason: "Integration start" }, idempotencyKey: "test-action-start-00001", correlationId: "request:2" });
    await worker.runOnce();
    record = (await repositories.hosted.getServer(id))!;
    expect(record).toMatchObject({ status: "running", lastErrorCode: null });
    await service.requestAction({ session: owner, serverInstanceId: id, payload: { action: "restart", expectedVersion: record.version, reason: "Integration restart" }, idempotencyKey: "test-action-restart-01", correlationId: "request:3" });
    await worker.runOnce();
    const after = app.instanceManager.getInstanceById(id)!;
    expect(after.state.serverInstance.worldSeed).toBe(worldSeed);
    expect(after.state.root.districtIds).toEqual(districtIds);
    expect((await repositories.hosted.getServer(id))?.status).toBe("running");
  });
});

const setup = async () => {
  const repositories = createInMemoryAdminDurableRepositories();
  await repositories.hosted.writeWorkerHeartbeat({ workerId: "worker:test", workerIncarnationId: "worker-incarnation:test",
    region: "eu-central", startedAt: NOW.toISOString(),
    lastHeartbeatAt: NOW.toISOString(), buildSha: "test", status: "online" });
  return { repositories, service: createHostedControlPlaneService({ repositories, environment: FLAGS, now: () => NOW, allowInMemoryForTests: true }) };
};
function session(role: AdminSessionView["role"]): AdminSessionView {
  return { adminSessionId: `session:${role}`, adminUserId: `user:${role}`, actorId: `user:${role}`,
    username: `test-${role}`, displayName: `Test ${role}`, role, authenticationMethod: "password",
    createdAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 60_000).toISOString(), revokedAt: null,
    lastSeenAt: NOW.toISOString() };
}
