import { describe, expect, it } from "vitest";
import type { AdminSessionView } from "@empire/shared-types";
import {
  createHostedControlPlaneService,
  createHostedRuntimeWorker,
  createPostgresHostedRuntimeMutationCommitter
} from "../../apps/server/src/admin/hosted";
import { createPostgresAdminDurableRepositories, hashAdminPassword } from "../../apps/server/src/admin/read-only";
import { createServerApp } from "../../apps/server/src/app";
import { createPostgresRuntimePersistenceRepositories } from "../../apps/server/src/runtime/persistence/postgres";
import { loadLocalEnvFile } from "../helpers/load-local-env.js";
import { createIsolatedPostgresTestSchema } from "./helpers/isolated-postgres-test-schema";

loadLocalEnvFile();
const databaseUrl = process.env.EMPIRE_TEST_DATABASE_URL?.trim();
const describeWhenDatabaseConfigured = databaseUrl ? describe : describe.skip;

describeWhenDatabaseConfigured("hosted control plane PostgreSQL live", () => {
  it("persists idempotent create, provisioning, lease and snapshot restore", async () => {
    const isolated = await createIsolatedPostgresTestSchema(databaseUrl!, "hosted_control_plane");
    const database = isolated.database;
    const repositories = createPostgresAdminDurableRepositories(database);
    const suffix = `${Date.now()}`;
    const adminUserId = `admin-user:live:${suffix}`;
    let serverInstanceId: string | null = null;
    const at = new Date().toISOString();
    const workerAt = new Date(Date.parse(at) + 1).toISOString();
    try {
      const password = await hashAdminPassword("TestPassword-Only-For-Fixtures");
      await repositories.users.create({ adminUserId, username: `LiveOwner${suffix}`, normalizedUsername: `liveowner${suffix}`,
        ...password, passwordVersion: 1, role: "owner", status: "active", displayName: "Live Owner",
        createdAt: at, updatedAt: at, lastLoginAt: null, passwordChangedAt: at, version: 1 });
      await repositories.hosted.writeWorkerHeartbeat({ workerId: `worker:live:A:${suffix}`,
        workerIncarnationId: `worker-incarnation:live:A:${suffix}`, region: "eu-central", startedAt: workerAt,
        lastHeartbeatAt: workerAt, buildSha: "test", status: "online" });
      const service = createHostedControlPlaneService({ repositories, environment: { NODE_ENV: "test",
        EMPIRE_ADMIN_WRITES_ENABLED: "true", EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
        EMPIRE_SERVER_PROVISIONING_ENABLED: "true", EMPIRE_BUILD_SHA: "test" } });
      const session: AdminSessionView = { adminSessionId: `session:live:${suffix}`, adminUserId, actorId: adminUserId,
        username: `LiveOwner${suffix}`, displayName: "Live Owner", role: "owner", authenticationMethod: "password",
        createdAt: at, expiresAt: new Date(Date.now() + 60_000).toISOString(), revokedAt: null, lastSeenAt: at };
      const payload = { mode: "free", serverTemplate: "full", displayName: "Live Hosted", region: "eu-central", capacity: 20, joinPolicy: "closed",
        mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 } };
      const first = await service.createServer({ session, payload, idempotencyKey: `live-create-${suffix}-0001`, correlationId: `request:${suffix}:1` });
      const replay = await service.createServer({ session, payload, idempotencyKey: `live-create-${suffix}-0001`, correlationId: `request:${suffix}:2` });
      if (!first.accepted) throw new Error(`Live create failed: ${first.errors[0]?.code ?? "unknown"}.`);
      if (!replay.accepted) throw new Error(`Live create replay failed: ${replay.errors[0]?.code ?? "unknown"}.`);
      expect(first).toMatchObject({ accepted: true });
      expect(replay).toMatchObject({ accepted: true });
      expect(replay.data.server.serverInstanceId).toBe(first.data.server.serverInstanceId);
      serverInstanceId = first.data.server.serverInstanceId;

      const persistence = createPostgresRuntimePersistenceRepositories({ databaseUrl: isolated.databaseUrl, database,
        tickLockOwnerId: `worker:live:A:${suffix}` });
      const appA = createServerApp({ persistence });
      const workerA = createHostedRuntimeWorker({ workerId: `worker:live:A:${suffix}`, region: "eu-central", buildSha: "test",
        controlPlane: repositories.hosted, server: appA,
        runtimeMutationCommitter: createPostgresHostedRuntimeMutationCommitter(database) });
      await workerA.runOnce();
      const record = await repositories.hosted.getServer(serverInstanceId);
      if (record?.status !== "lobby" || record.provisioningState !== "ready") {
        throw new Error(`Hosted live provisioning failed: ${record?.lastErrorCode ?? "UNKNOWN"}.`);
      }
      expect(record).toMatchObject({ status: "lobby", provisioningState: "ready", joinPolicy: "closed" });
      const openRegistration = await service.requestAction({
        session,
        serverInstanceId,
        payload: {
          action: "open-registration-now",
          expectedVersion: record.version,
          reason: "Exercise active lobby recovery"
        },
        idempotencyKey: `live-open-registration-${suffix}`,
        correlationId: `request:${suffix}:open-registration`
      });
      if (!openRegistration.accepted) {
        throw new Error(`Hosted live registration open failed: ${openRegistration.errors[0]?.code ?? "unknown"}.`);
      }
      await workerA.runOnce();
      expect(await repositories.hosted.getServer(serverInstanceId)).toMatchObject({
        status: "lobby",
        joinPolicy: "open"
      });
      const runtimeA = appA.instanceManager.getInstanceById(serverInstanceId)!;
      const worldSeed = runtimeA.state.serverInstance.worldSeed;
      const districtIds = [...runtimeA.state.root.districtIds];
      await workerA.stop();

      const appB = createServerApp({ persistence });
      const workerB = createHostedRuntimeWorker({ workerId: `worker:live:B:${suffix}`, region: "eu-central", buildSha: "test",
        controlPlane: repositories.hosted, server: appB,
        runtimeMutationCommitter: createPostgresHostedRuntimeMutationCommitter(database) });
      await workerB.heartbeat();
      await workerB.restoreKnownInstances();
      const runtimeB = appB.instanceManager.getInstanceById(serverInstanceId)!;
      expect(runtimeB.state.serverInstance.worldSeed).toBe(worldSeed);
      expect(runtimeB.state.root.districtIds).toEqual(districtIds);
      await repositories.hosted.writeWorkerHeartbeat({ workerId: `worker:live:C:${suffix}`,
        workerIncarnationId: `worker-incarnation:live:C:${suffix}`, region: "eu-central", startedAt: at,
        lastHeartbeatAt: new Date().toISOString(), buildSha: "test", status: "online" });
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
      await isolated.close();
    }
  }, 60_000);
});
