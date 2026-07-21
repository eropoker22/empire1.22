import { describe, expect, it } from "vitest";
import type { AdminSessionView } from "@empire/shared-types";
import { createHostedControlPlaneService, createHostedRuntimeWorker } from "../../apps/server/src/admin/hosted";
import { createPostgresAdminDurableRepositories, hashAdminPassword } from "../../apps/server/src/admin/read-only";
import { createServerApp } from "../../apps/server/src/app";
import { createPostgresDatabase, createPostgresRuntimePersistenceRepositories } from "../../apps/server/src/runtime/persistence/postgres";

const databaseUrl = process.env.EMPIRE_TEST_DATABASE_URL?.trim();
const describeWhenDatabaseConfigured = databaseUrl ? describe : describe.skip;

describeWhenDatabaseConfigured("hosted control plane PostgreSQL live", () => {
  it("persists idempotent create, provisioning, lease and snapshot restore", async () => {
    const database = createPostgresDatabase(databaseUrl!);
    const repositories = createPostgresAdminDurableRepositories(database);
    const suffix = `${Date.now()}`;
    const adminUserId = `admin-user:live:${suffix}`;
    let serverInstanceId: string | null = null;
    const at = new Date().toISOString();
    try {
      const password = await hashAdminPassword("TestPassword-Only-For-Fixtures");
      await repositories.users.create({ adminUserId, username: `LiveOwner${suffix}`, normalizedUsername: `liveowner${suffix}`,
        ...password, passwordVersion: 1, role: "owner", status: "active", displayName: "Live Owner",
        createdAt: at, updatedAt: at, lastLoginAt: null, passwordChangedAt: at, version: 1 });
      await repositories.hosted.writeWorkerHeartbeat({ workerId: `worker:live:A:${suffix}`,
        workerIncarnationId: `worker-incarnation:live:A:${suffix}`, region: "eu-central", startedAt: at,
        lastHeartbeatAt: at, buildSha: "live-test", status: "online" });
      const service = createHostedControlPlaneService({ repositories, environment: { NODE_ENV: "test",
        EMPIRE_ADMIN_WRITES_ENABLED: "true", EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true", EMPIRE_SERVER_PROVISIONING_ENABLED: "true" } });
      const session: AdminSessionView = { adminSessionId: `session:live:${suffix}`, adminUserId, actorId: adminUserId,
        username: `LiveOwner${suffix}`, displayName: "Live Owner", role: "owner", authenticationMethod: "password",
        createdAt: at, expiresAt: new Date(Date.now() + 60_000).toISOString(), revokedAt: null, lastSeenAt: at };
      const payload = { mode: "free", serverTemplate: "full", displayName: "Live Hosted", region: "eu-central", capacity: 20, joinPolicy: "closed",
        mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 } };
      const first = await service.createServer({ session, payload, idempotencyKey: `live-create-${suffix}-0001`, correlationId: `request:${suffix}:1` });
      const replay = await service.createServer({ session, payload, idempotencyKey: `live-create-${suffix}-0001`, correlationId: `request:${suffix}:2` });
      expect(first.accepted && replay.accepted && replay.data.server.serverInstanceId).toBe(first.accepted ? first.data.server.serverInstanceId : "");
      if (!first.accepted) throw new Error("Live create failed.");
      serverInstanceId = first.data.server.serverInstanceId;

      const persistence = createPostgresRuntimePersistenceRepositories({ databaseUrl: databaseUrl!, database,
        tickLockOwnerId: `worker:live:A:${suffix}` });
      const appA = createServerApp({ persistence });
      const workerA = createHostedRuntimeWorker({ workerId: `worker:live:A:${suffix}`, region: "eu-central", buildSha: "live-test",
        controlPlane: repositories.hosted, server: appA });
      await workerA.runOnce();
      const record = await repositories.hosted.getServer(serverInstanceId);
      expect(record).toMatchObject({ status: "lobby", provisioningState: "ready", joinPolicy: "closed" });
      const runtimeA = appA.instanceManager.getInstanceById(serverInstanceId)!;
      const worldSeed = runtimeA.state.serverInstance.worldSeed;
      const districtIds = [...runtimeA.state.root.districtIds];
      await workerA.stop();

      const appB = createServerApp({ persistence });
      const workerB = createHostedRuntimeWorker({ workerId: `worker:live:B:${suffix}`, region: "eu-central", buildSha: "live-test",
        controlPlane: repositories.hosted, server: appB });
      await workerB.heartbeat();
      await workerB.restoreKnownInstances();
      const runtimeB = appB.instanceManager.getInstanceById(serverInstanceId)!;
      expect(runtimeB.state.serverInstance.worldSeed).toBe(worldSeed);
      expect(runtimeB.state.root.districtIds).toEqual(districtIds);
      await repositories.hosted.writeWorkerHeartbeat({ workerId: `worker:live:C:${suffix}`,
        workerIncarnationId: `worker-incarnation:live:C:${suffix}`, region: "eu-central", startedAt: at,
        lastHeartbeatAt: new Date().toISOString(), buildSha: "live-test", status: "online" });
      expect(await repositories.hosted.acquireRuntimeLease({ serverInstanceId, workerId: `worker:live:C:${suffix}`,
        workerIncarnationId: `worker-incarnation:live:C:${suffix}`, now: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 20_000).toISOString() })).toBe(false);
      const concurrentVersion = (await repositories.hosted.getServer(serverInstanceId))?.version;
      if (!concurrentVersion) throw new Error("Live hosted server disappeared before concurrent start test.");
      const concurrentStarts = await Promise.all(["a", "b"].map((key) => service.requestAction({
        session,
        serverInstanceId: serverInstanceId!,
        payload: { action: "start", expectedVersion: concurrentVersion, reason: `Concurrent live start ${key}` },
        idempotencyKey: `live-concurrent-start-${suffix}-${key}`,
        correlationId: `request:${suffix}:start:${key}`
      })));
      expect(concurrentStarts.filter((result) => result.accepted)).toHaveLength(1);
      expect(concurrentStarts.find((result) => !result.accepted)?.errors[0]?.code)
        .toBe("SERVER_LIFECYCLE_OPERATION_ACTIVE");
      await workerB.stop();
    } finally {
      if (serverInstanceId) {
        await database.query("DELETE FROM empire_hosted_instance_heartbeats WHERE server_instance_id=$1", [serverInstanceId]);
        await database.query("DELETE FROM empire_hosted_server_action_requests WHERE server_instance_id=$1", [serverInstanceId]);
        await database.query("DELETE FROM empire_hosted_server_provisioning_jobs WHERE server_instance_id=$1", [serverInstanceId]);
        await database.query("DELETE FROM empire_hosted_server_idempotency WHERE resource_id=$1", [serverInstanceId]);
        await database.query("DELETE FROM empire_hosted_server_instances WHERE server_instance_id=$1", [serverInstanceId]);
        await database.query("DELETE FROM empire_server_instances WHERE server_instance_id=$1", [serverInstanceId]);
      }
      await database.query("DELETE FROM empire_hosted_instance_heartbeats WHERE worker_id LIKE $1", [`worker:live:%:${suffix}`]);
      await database.query("DELETE FROM empire_hosted_worker_heartbeats WHERE worker_id LIKE $1", [`worker:live:%:${suffix}`]);
      await database.query("DELETE FROM empire_hosted_server_idempotency WHERE admin_user_id=$1", [adminUserId]);
      await database.query("DELETE FROM empire_admin_access_audit WHERE actor_id=$1", [adminUserId]);
      await database.query("DELETE FROM empire_admin_users WHERE admin_user_id=$1", [adminUserId]);
      await database.close();
    }
  }, 20_000);
});
