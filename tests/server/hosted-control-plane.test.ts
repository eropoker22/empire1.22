import { describe, expect, it } from "vitest";
import {
  copyFreeHostedStartingPlayerState,
  FREE_HOSTED_STARTING_MATERIAL_IDS,
  resolveModeConfig
} from "@empire/game-config";
import { handleSelectSpawnDistrict } from "@empire/game-core";
import type { AdminCreateServerRequestView, AdminSessionView } from "@empire/shared-types";
import { createHostedControlPlaneService, createHostedRuntimeWorker } from "../../apps/server/src/admin/hosted";
import { createHostedAdminServerView } from "../../apps/server/src/admin/hosted/hosted-control-plane-policy";
import type { InMemoryHostedControlPlaneRepository } from "../../apps/server/src/admin/hosted/in-memory-hosted-control-plane-repository";
import { createInMemoryAdminDurableRepositories } from "../../apps/server/src/admin/read-only";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { findSharedCitySpawnCandidate } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";

const NOW = new Date("2026-07-16T10:00:00.000Z");
const FLAGS = { NODE_ENV: "test", EMPIRE_ADMIN_WRITES_ENABLED: "true", EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
  EMPIRE_SERVER_PROVISIONING_ENABLED: "true", EMPIRE_BUILD_SHA: "test" };
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

  it("authorizes writes without loading every historical server read model", async () => {
    const { repositories, service } = await setup();
    let adminStatsCalls = 0;
    let listServersCalls = 0;
    const loadAdminStats = repositories.hosted.getAdminServerStats.bind(
      repositories.hosted
    );
    const listServers = repositories.hosted.listServers.bind(repositories.hosted);
    repositories.hosted.getAdminServerStats = async (...args) => {
      adminStatsCalls += 1;
      return loadAdminStats(...args);
    };
    repositories.hosted.listServers = async (...args) => {
      listServersCalls += 1;
      return listServers(...args);
    };

    const created = await service.createServer({
      session: owner,
      payload: validRequest,
      idempotencyKey: "test-create-lightweight-write-gate",
      correlationId: "request:lightweight-write-gate"
    });

    expect(created.accepted).toBe(true);
    expect(adminStatsCalls).toBe(0);
    expect(listServersCalls).toBe(0);
    if (!created.accepted) return;

    const worker = createHostedRuntimeWorker({
      workerId: "worker:test",
      region: "eu-central",
      buildSha: "test",
      controlPlane: repositories.hosted,
      server: createServerApp(),
      now: () => NOW
    });
    await worker.runOnce();
    const server = await repositories.hosted.getServer(created.data.server.serverInstanceId);
    if (!server) throw new Error("fixture server missing");
    adminStatsCalls = 0;
    listServersCalls = 0;

    const action = await service.requestAction({
      session: owner,
      serverInstanceId: server.serverInstanceId,
      payload: {
        action: "open-registration-now",
        expectedVersion: server.version,
        reason: "Lightweight lifecycle write gate"
      },
      idempotencyKey: "test-action-lightweight-write-gate",
      correlationId: "request:lightweight-action-gate"
    });

    expect(action.accepted).toBe(true);
    expect(adminStatsCalls).toBe(0);
    expect(listServersCalls).toBe(0);
    await service.availability();
    expect(adminStatsCalls).toBe(1);
    expect(listServersCalls).toBe(1);
  });

  it("loads scoped availability without scanning or leaking other hosted servers", async () => {
    const { repositories, service } = await setup();
    const selected = await service.createServer({
      session: owner,
      payload: { ...validRequest, displayName: "Selected server" },
      idempotencyKey: "test-scoped-availability-selected",
      correlationId: "request:scoped:selected"
    });
    const other = await service.createServer({
      session: owner,
      payload: { ...validRequest, displayName: "Other server" },
      idempotencyKey: "test-scoped-availability-other",
      correlationId: "request:scoped:other"
    });
    if (!selected.accepted || !other.accepted) throw new Error("fixture create failed");

    const getServer = repositories.hosted.getServer.bind(repositories.hosted);
    const getAdminServerStats = repositories.hosted.getAdminServerStats.bind(
      repositories.hosted
    );
    const listServers = repositories.hosted.listServers.bind(repositories.hosted);
    const loadedServerIds: string[] = [];
    const statsRequests: string[][] = [];
    let listServersCalls = 0;
    repositories.hosted.getServer = async (serverInstanceId) => {
      loadedServerIds.push(serverInstanceId);
      return getServer(serverInstanceId);
    };
    repositories.hosted.getAdminServerStats = async (serverInstanceIds, at) => {
      statsRequests.push([...serverInstanceIds]);
      return getAdminServerStats(serverInstanceIds, at);
    };
    repositories.hosted.listServers = async (...args) => {
      listServersCalls += 1;
      return listServers(...args);
    };

    const scoped = await service.availabilityForInstance(
      selected.data.server.serverInstanceId
    );

    expect(scoped.servers.map((server) => server.serverInstanceId)).toEqual([
      selected.data.server.serverInstanceId
    ]);
    expect(scoped.servers).not.toContainEqual(expect.objectContaining({
      serverInstanceId: other.data.server.serverInstanceId
    }));
    expect(loadedServerIds).toEqual([selected.data.server.serverInstanceId]);
    expect(statsRequests).toEqual([[selected.data.server.serverInstanceId]]);
    expect(listServersCalls).toBe(0);

    loadedServerIds.length = 0;
    statsRequests.length = 0;
    const missing = await service.availabilityForInstance("instance:missing");

    expect(missing.servers).toEqual([]);
    expect(loadedServerIds).toEqual(["instance:missing"]);
    expect(statsRequests.flat()).toEqual([]);
    expect(listServersCalls).toBe(0);
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

  it("blocks writes when API and worker build SHAs are unavailable or mismatched", async () => {
    const repositories = createInMemoryAdminDurableRepositories();
    await repositories.hosted.writeWorkerHeartbeat({ workerId: "worker:test", workerIncarnationId: "worker-incarnation:test",
      region: "eu-central", startedAt: NOW.toISOString(), lastHeartbeatAt: NOW.toISOString(),
      buildSha: "worker-sha", status: "online" });
    const missing = createHostedControlPlaneService({ repositories,
      environment: { ...FLAGS, EMPIRE_BUILD_SHA: "" }, now: () => NOW, allowInMemoryForTests: true });
    expect((await missing.availability()).unavailableCode).toBe("BUILD_SHA_UNAVAILABLE");
    const mismatched = createHostedControlPlaneService({ repositories,
      environment: { ...FLAGS, EMPIRE_BUILD_SHA: "api-sha" }, now: () => NOW, allowInMemoryForTests: true });
    expect((await mismatched.availability()).unavailableCode).toBe("BUILD_SHA_MISMATCH");
    expect((await mismatched.createServer({ session: owner, payload: validRequest,
      idempotencyKey: "test-create-build-mismatch", correlationId: "build-mismatch" })).errors[0]?.code)
      .toBe("BUILD_SHA_MISMATCH");
  });

  it("blocks production writes when session or origin policy is not secure", async () => {
    const repositories = createInMemoryAdminDurableRepositories();
    await repositories.hosted.writeWorkerHeartbeat({ workerId: "worker:test", workerIncarnationId: "worker-incarnation:test",
      region: "eu-central", startedAt: NOW.toISOString(), lastHeartbeatAt: NOW.toISOString(),
      buildSha: "test", status: "online" });
    const insecure = createHostedControlPlaneService({ repositories,
      environment: { ...FLAGS, NODE_ENV: "production" }, now: () => NOW, allowInMemoryForTests: true });
    expect(await insecure.availability()).toMatchObject({
      sessionSecurity: "blocked",
      originPolicy: "blocked",
      registrationEnabled: false,
      unavailableCode: "SESSION_SECURITY_INVALID"
    });
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
      minimumReadyPlayersToStart: 1,
      registrationWindowMinutes: 60,
      canonicalFirstEliminationTick: null,
      canonicalTickRateMs: null
    });
    expect((await service.createServer({ session: owner,
      payload: { ...validRequest, serverTemplate: "full", capacity: 2 },
      idempotencyKey: "test-create-full-small", correlationId: "full" })).errors[0]?.code)
      .toBe("ADMIN_CAPACITY_INVALID");
  });

  it("validates and snapshots the authoritative starting player state", async () => {
    const { repositories, service } = await setup();
    const startingPlayerState = copyFreeHostedStartingPlayerState();
    const expectedMaterials = Object.fromEntries(
      FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId, index) => [materialId, index * 137])
    ) as typeof startingPlayerState.materials;
    startingPlayerState.cleanCash = 0;
    startingPlayerState.dirtyCash = 7_500;
    startingPlayerState.population = 0;
    startingPlayerState.materials = Object.fromEntries(
      [...FREE_HOSTED_STARTING_MATERIAL_IDS].reverse()
        .map((materialId) => [materialId, expectedMaterials[materialId]])
    ) as typeof startingPlayerState.materials;
    const created = await service.createServer({
      session: owner,
      payload: { ...validRequest, startingPlayerState },
      idempotencyKey: "test-create-starting-state",
      correlationId: "starting-state"
    });
    expect(created.accepted).toBe(true);
    if (!created.accepted) return;
    const persisted = await repositories.hosted.getServer(created.data.server.serverInstanceId);
    expect(persisted).toMatchObject({
      startingPlayerState: {
        cleanCash: 0,
        dirtyCash: 7_500,
        population: 0,
        spySlots: 2,
        materials: expectedMaterials
      }
    });
    expect(Object.keys(persisted!.startingPlayerState!.materials)).toEqual(FREE_HOSTED_STARTING_MATERIAL_IDS);

    expect((await service.createServer({
      session: owner,
      payload: { ...validRequest, startingPlayerState: { ...startingPlayerState, spySlots: 3 } },
      idempotencyKey: "test-create-starting-spies",
      correlationId: "starting-spies"
    })).errors[0]?.code).toBe("ADMIN_STARTING_STATE_INVALID");
    const missingMaterial = {
      ...startingPlayerState,
      materials: { ...startingPlayerState.materials }
    } as Record<string, unknown>;
    delete (missingMaterial.materials as Record<string, unknown>).chemicals;
    expect((await service.createServer({
      session: owner,
      payload: { ...validRequest, startingPlayerState: missingMaterial },
      idempotencyKey: "test-create-starting-material",
      correlationId: "starting-material"
    })).errors[0]?.code).toBe("ADMIN_STARTING_STATE_INVALID");
    expect((await service.createServer({
      session: owner,
      payload: {
        ...validRequest,
        startingPlayerState: {
          ...startingPlayerState,
          cleanCash: "0"
        }
      },
      idempotencyKey: "test-create-starting-string",
      correlationId: "starting-string"
    })).errors[0]?.code).toBe("ADMIN_STARTING_STATE_INVALID");
    const aliasedMaterial = {
      ...startingPlayerState,
      materials: {
        ...startingPlayerState.materials,
        metalParts: startingPlayerState.materials["metal-parts"]
      }
    } as Record<string, unknown>;
    delete (aliasedMaterial.materials as Record<string, unknown>)["metal-parts"];
    expect((await service.createServer({
      session: owner,
      payload: { ...validRequest, startingPlayerState: aliasedMaterial },
      idempotencyKey: "test-create-starting-alias",
      correlationId: "starting-alias"
    })).errors[0]?.code).toBe("ADMIN_STARTING_STATE_INVALID");
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
    await expect(serverApp.instanceManager.getPersistenceRepositories().snapshotRepository
      .countCheckpoints(created.data.server.serverInstanceId)).resolves.toMatchObject({
        total: 1,
        lifecycle: 1
      });
    await worker.runOnce();
    expect((await repositories.hosted.getServer(created.data.server.serverInstanceId))?.initialSnapshotId).toBe(snapshot?.snapshotId);
    await expect(serverApp.instanceManager.getPersistenceRepositories().snapshotRepository
      .countCheckpoints(created.data.server.serverInstanceId)).resolves.toMatchObject({
        total: 1,
        lifecycle: 1
      });
  });

  it("explains an unscheduled dormant lobby before reporting its inactive runtime lease", async () => {
    const { repositories, service } = await setup();
    const created = await service.createServer({ session: owner, payload: validRequest,
      idempotencyKey: "test-dormant-registration-copy", correlationId: "request:dormant" });
    if (!created.accepted) throw new Error("fixture create failed");
    const worker = createHostedRuntimeWorker({ workerId: "worker:test", region: "eu-central", buildSha: "test",
      controlPlane: repositories.hosted, server: createServerApp(), now: () => NOW });
    await worker.runOnce();
    const record = await repositories.hosted.getServer(created.data.server.serverInstanceId);
    if (!record) throw new Error("fixture server missing");

    const view = createHostedAdminServerView({
      server: { ...record, runtimeLeaseOwnerId: null, runtimeLeaseExpiresAt: null, lastWorkerHeartbeatAt: null },
      now: NOW,
      committedPlayers: 0,
      reservedSlots: 0,
      readyPlayers: 0
    });

    expect(view.startDisabledReason).toBe("Registrace na tento server ještě nezačala.");
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

  it("archives a server idempotently and releases its ready memberships", async () => {
    const { repositories, service } = await setup();
    const created = await service.createServer({ session: owner, payload: validRequest,
      idempotencyKey: "test-archive-server-create", correlationId: "request:archive:create" });
    if (!created.accepted) throw new Error("fixture create failed");
    const serverId = created.data.server.serverInstanceId;
    const hosted = repositories.hosted as InMemoryHostedControlPlaneRepository;
    hosted.setReadyMembershipsForTests(serverId, [{
      membershipId: "membership:archive",
      playerId: "player:archive",
      reservedSpawnDistrictId: "district:archive"
    }]);
    const key = "test-archive-server-action";
    const payload = {
      action: "delete",
      expectedVersion: created.data.server.version,
      reason: "Odstranění nefunkční instance",
      confirmationToken: "DELETE_SERVER"
    };

    const first = await service.requestAction({ session: owner, serverInstanceId: serverId, payload,
      idempotencyKey: key, correlationId: "request:archive:first" });
    const replay = await service.requestAction({ session: owner, serverInstanceId: serverId, payload,
      idempotencyKey: key, correlationId: "request:archive:replay" });

    expect(first).toMatchObject({ accepted: true, data: { action: "delete", status: "completed", replayed: false } });
    expect(replay).toMatchObject({ accepted: true, data: { action: "delete", status: "completed", replayed: true } });
    expect(await repositories.hosted.getServer(serverId)).toMatchObject({
      status: "archived",
      joinPolicy: "closed",
      runtimeLeaseOwnerId: null,
      runtimeLeaseExpiresAt: null
    });
    await expect(repositories.hosted.listReadyMemberships(serverId)).resolves.toEqual([]);
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
    let visibleReadyMemberships: typeof readyMemberships = [];
    const hostedRepository = repositories.hosted as InMemoryHostedControlPlaneRepository;
    hostedRepository.setReadyMembershipsForTests(id, visibleReadyMemberships);
    await app.instanceManager.saveInstanceSnapshot(id);
    await service.requestAction({ session: owner, serverInstanceId: id,
      payload: { action: "start", expectedVersion: record.version, reason: "Reject one player start" },
      idempotencyKey: "test-action-start-zero-01", correlationId: "request:zero" });
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
    await expect(app.instanceManager.getPersistenceRepositories().snapshotRepository
      .countCheckpoints(id)).resolves.toMatchObject({
        total: 3,
        lifecycle: 3
      });
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
