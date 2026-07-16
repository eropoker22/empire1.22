import { describe, expect, it } from "vitest";
import type { AdminCreateServerRequestView, AdminSessionView } from "@empire/shared-types";
import { createHostedControlPlaneService, createHostedRuntimeWorker } from "../../apps/server/src/admin/hosted";
import { createInMemoryAdminDurableRepositories } from "../../apps/server/src/admin/read-only";
import { createServerApp } from "../../apps/server/src/app";

const NOW = new Date("2026-07-16T10:00:00.000Z");
const FLAGS = { NODE_ENV: "test", EMPIRE_ADMIN_WRITES_ENABLED: "true", EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true", EMPIRE_SERVER_PROVISIONING_ENABLED: "true" };
const owner = session("owner");
const validRequest: AdminCreateServerRequestView = {
  mode: "free", displayName: "Hosted Test", region: "eu-central", capacity: 20, joinPolicy: "closed",
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
    expect((await service.createServer({ session: owner, payload: { ...validRequest, mapComposition: { ...validRequest.mapComposition, downtown: 7, park: 38 } }, idempotencyKey: "test-create-map-invalid1", correlationId: "r" })).accepted).toBe(false);
    const repositories = createInMemoryAdminDurableRepositories();
    const disabled = createHostedControlPlaneService({ repositories, environment: { NODE_ENV: "test" }, allowInMemoryForTests: true });
    expect((await disabled.createServer({ session: owner, payload: validRequest, idempotencyKey: "test-create-disabled-001", correlationId: "r" })).errors[0]?.code).toBe("ADMIN_WRITES_DISABLED");
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

  it("uses exclusive leases and restores the same state across lifecycle restart", async () => {
    const { repositories, service } = await setup();
    const created = await service.createServer({ session: owner, payload: validRequest, idempotencyKey: "test-lifecycle-server-01", correlationId: "request:1" });
    if (!created.accepted) throw new Error("fixture create failed");
    const app = createServerApp();
    const worker = createHostedRuntimeWorker({ workerId: "worker:A", region: "eu-central", buildSha: "test", controlPlane: repositories.hosted, server: app, now: () => NOW });
    await worker.runOnce();
    const id = created.data.server.serverInstanceId;
    expect(await repositories.hosted.acquireRuntimeLease({ serverInstanceId: id, workerId: "worker:B", now: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 20_000).toISOString() })).toBe(false);
    const before = app.instanceManager.getInstanceById(id)!;
    const worldSeed = before.state.serverInstance.worldSeed;
    const districtIds = [...before.state.root.districtIds];
    let record = (await repositories.hosted.getServer(id))!;
    await service.requestAction({ session: owner, serverInstanceId: id, payload: { action: "start", expectedVersion: record.version, reason: "Integration start" }, idempotencyKey: "test-action-start-00001", correlationId: "request:2" });
    await worker.runOnce();
    record = (await repositories.hosted.getServer(id))!;
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
  await repositories.hosted.writeWorkerHeartbeat({ workerId: "worker:test", region: "eu-central", startedAt: NOW.toISOString(),
    lastHeartbeatAt: NOW.toISOString(), buildSha: "test", status: "online" });
  return { repositories, service: createHostedControlPlaneService({ repositories, environment: FLAGS, now: () => NOW, allowInMemoryForTests: true }) };
};
function session(role: AdminSessionView["role"]): AdminSessionView {
  return { adminSessionId: `session:${role}`, adminUserId: `user:${role}`, actorId: `user:${role}`,
    username: `test-${role}`, displayName: `Test ${role}`, role, authenticationMethod: "password",
    createdAt: NOW.toISOString(), expiresAt: new Date(NOW.getTime() + 60_000).toISOString(), revokedAt: null,
    lastSeenAt: NOW.toISOString() };
}
