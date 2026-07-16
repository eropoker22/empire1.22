import * as crypto from "node:crypto";
import type { AdminAuditEntryView } from "@empire/shared-types";
import type { ServerApp } from "../../app/server-app";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import type { HostedActionRequestRecord, HostedControlPlaneRepository, HostedServerRecord } from "./hosted-control-plane-repository";

const CLAIM_TTL_MS = 30_000;
const RUNTIME_LEASE_MS = 20_000;

export const createHostedRuntimeWorker = (options: {
  workerId: string;
  region: string;
  buildSha: string;
  controlPlane: HostedControlPlaneRepository;
  server: ServerApp;
  now?: () => Date;
}) => {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  let stopped = false;

  const heartbeat = (status: "online" | "draining" | "stopped" | "failed" = "online") =>
    options.controlPlane.writeWorkerHeartbeat({ workerId: options.workerId, region: options.region,
      buildSha: options.buildSha, startedAt, lastHeartbeatAt: now().toISOString(), status });

  const restoreKnownInstances = async (): Promise<void> => {
    const servers = await options.controlPlane.listServers();
    for (const record of servers.filter((entry) => entry.provisioningState === "ready" && entry.status !== "archived" && entry.status !== "failed")) {
      const at = now();
      const leaseExpiresAt = new Date(at.getTime() + RUNTIME_LEASE_MS).toISOString();
      if (await options.controlPlane.acquireRuntimeLease({ serverInstanceId: record.serverInstanceId,
        workerId: options.workerId, now: at.toISOString(), expiresAt: leaseExpiresAt })) {
        await ensureRuntime(record, true);
      }
    }
  };

  const runOnce = async (): Promise<void> => {
    if (stopped) return;
    await heartbeat();
    await processProvisioningJob();
    await processAction();
    await tickOwnedInstances();
  };

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    await heartbeat("draining");
    for (const runtime of options.server.instanceManager.listInstances()) {
      await options.server.instanceManager.saveInstanceSnapshot(runtime.record.id);
      await options.controlPlane.releaseRuntimeLease(runtime.record.id, options.workerId, now().toISOString());
    }
    await heartbeat("stopped");
  };

  const processProvisioningJob = async (): Promise<void> => {
    const claimedAt = now();
    const job = await options.controlPlane.claimProvisioningJob(options.workerId, claimedAt.toISOString(),
      new Date(claimedAt.getTime() + CLAIM_TTL_MS).toISOString());
    if (!job) return;
    try {
      if (!await options.controlPlane.beginProvisioning(job.jobId, job.serverInstanceId, claimedAt.toISOString())) {
        throw safe("PROVISIONING_STATE_CONFLICT");
      }
      const record = await options.controlPlane.getServer(job.serverInstanceId);
      if (!record) throw safe("PROVISIONING_SERVER_NOT_FOUND");
      const leaseExpiresAt = new Date(claimedAt.getTime() + RUNTIME_LEASE_MS).toISOString();
      if (!await options.controlPlane.acquireRuntimeLease({ serverInstanceId: record.serverInstanceId,
        workerId: options.workerId, now: claimedAt.toISOString(), expiresAt: leaseExpiresAt })) {
        throw safe("PROVISIONING_LEASE_UNAVAILABLE");
      }
      const runtime = await ensureRuntime(record, true);
      runtime.lobby.joinPolicy = "closed";
      runtime.record.status = "lobby";
      await options.server.instanceManager.saveInstanceSnapshot(record.serverInstanceId);
      const snapshot = await options.server.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(record.serverInstanceId);
      if (!snapshot) throw safe("INITIAL_SNAPSHOT_MISSING");
      const at = now().toISOString();
      await options.controlPlane.completeProvisioning({ jobId: job.jobId, serverInstanceId: record.serverInstanceId,
        snapshotId: snapshot.snapshotId, at, audit: workerAudit("provisioning-success", record.serverInstanceId, at) });
      await options.controlPlane.writeInstanceHeartbeat({ serverInstanceId: record.serverInstanceId, workerId: options.workerId,
        leaseExpiresAt, lastTick: runtime.state.root.tick, lastSnapshotAt: snapshot.createdAt, lastErrorCode: null, at });
    } catch (error) {
      const at = now().toISOString();
      const code = safeCode(error);
      await options.controlPlane.failProvisioning({ jobId: job.jobId, serverInstanceId: job.serverInstanceId,
        errorCode: code, at, audit: workerAudit("provisioning-failure", job.serverInstanceId, at, "failure") });
      await options.controlPlane.releaseRuntimeLease(job.serverInstanceId, options.workerId, at);
    }
  };

  const processAction = async (): Promise<void> => {
    const claimedAt = now();
    const request = await options.controlPlane.claimAction(options.workerId, claimedAt.toISOString(),
      new Date(claimedAt.getTime() + CLAIM_TTL_MS).toISOString());
    if (!request) return;
    try {
      const server = await options.controlPlane.getServer(request.serverInstanceId);
      if (!server) throw safe("LIFECYCLE_SERVER_NOT_FOUND");
      if (server.version !== request.expectedVersion) throw safe("LIFECYCLE_STALE_VERSION");
      const transition = await applyAction(server, request);
      const at = now().toISOString();
      await options.controlPlane.completeAction({ request, ...transition, at,
        audit: workerAudit("lifecycle-success", request.serverInstanceId, at) });
      if (transition.releaseLease) {
        await options.controlPlane.releaseRuntimeLease(request.serverInstanceId, options.workerId, at);
      }
    } catch (error) {
      const at = now().toISOString();
      await options.controlPlane.failAction({ request, errorCode: safeCode(error), at,
        audit: workerAudit("lifecycle-failure", request.serverInstanceId, at, "failure") });
    }
  };

  const applyAction = async (server: HostedServerRecord, request: HostedActionRequestRecord) => {
    const runtime = await ensureRuntime(server);
    const leaseAt = now();
    const leaseExpiresAt = new Date(leaseAt.getTime() + RUNTIME_LEASE_MS).toISOString();
    const requireLease = async () => {
      if (!await options.controlPlane.acquireRuntimeLease({ serverInstanceId: server.serverInstanceId,
        workerId: options.workerId, now: leaseAt.toISOString(), expiresAt: leaseExpiresAt })) throw safe("RUNTIME_LEASE_UNAVAILABLE");
    };
    await requireLease();
    switch (request.action) {
      case "open-joins":
        if (server.provisioningState !== "ready" || !(["lobby", "running"] as string[]).includes(server.status)) throw safe("JOINS_NOT_READY");
        options.server.instanceManager.openInstanceForJoin(server.serverInstanceId);
        return { nextStatus: server.status, nextJoinPolicy: "open" as const, releaseLease: false };
      case "close-joins":
        options.server.instanceManager.closeInstanceForJoin(server.serverInstanceId);
        return { nextStatus: server.status, nextJoinPolicy: "closed" as const, releaseLease: false };
      case "start":
        if (server.status !== "lobby") throw safe("START_INVALID_STATE");
        options.server.instanceManager.startInstance(server.serverInstanceId);
        return { nextStatus: "running" as const, nextJoinPolicy: server.joinPolicy, releaseLease: false };
      case "pause":
        if (server.status !== "running") throw safe("PAUSE_INVALID_STATE");
        await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
        options.server.instanceManager.pauseInstance(server.serverInstanceId);
        return { nextStatus: "paused" as const, nextJoinPolicy: server.joinPolicy, releaseLease: false };
      case "resume":
        if (server.status !== "paused") throw safe("RESUME_INVALID_STATE");
        options.server.instanceManager.startInstance(server.serverInstanceId);
        return { nextStatus: "running" as const, nextJoinPolicy: server.joinPolicy, releaseLease: false };
      case "restart": {
        if (!(server.status === "running" || server.status === "restarting")) throw safe("RESTART_INVALID_STATE");
        await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
        if (!await options.controlPlane.prepareRuntimeRestart({ serverInstanceId: server.serverInstanceId,
          workerId: options.workerId, expectedVersion: request.expectedVersion, at: now().toISOString() })) {
          throw safe("RESTART_STATE_CONFLICT");
        }
        await options.controlPlane.releaseRuntimeLease(server.serverInstanceId, options.workerId, now().toISOString());
        await options.server.instanceManager.restoreInstance(server.serverInstanceId);
        await requireLease();
        options.server.instanceManager.startInstance(server.serverInstanceId);
        return { nextStatus: "running" as const, nextJoinPolicy: "closed" as const, releaseLease: false };
      }
      case "stop":
        await options.server.instanceManager.saveInstanceSnapshot(server.serverInstanceId);
        options.server.instanceManager.stopInstance(server.serverInstanceId);
        return { nextStatus: "stopped" as const, nextJoinPolicy: "closed" as const, releaseLease: true };
    }
  };

  const tickOwnedInstances = async (): Promise<void> => {
    const records = await options.controlPlane.listServers();
    for (const record of records.filter((entry) => entry.provisioningState === "ready" && ["lobby", "running", "paused"].includes(entry.status))) {
      const at = now();
      const leaseExpiresAt = new Date(at.getTime() + RUNTIME_LEASE_MS).toISOString();
      const owned = await options.controlPlane.acquireRuntimeLease({ serverInstanceId: record.serverInstanceId,
        workerId: options.workerId, now: at.toISOString(), expiresAt: leaseExpiresAt });
      if (!owned) continue;
      const runtime = await ensureRuntime(record, true);
      if (record.status === "running") options.server.instanceManager.tickInstance(record.serverInstanceId);
      await options.server.instanceManager.saveInstanceSnapshot(record.serverInstanceId);
      const snapshot = await options.server.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(record.serverInstanceId);
      await options.controlPlane.writeInstanceHeartbeat({ serverInstanceId: record.serverInstanceId, workerId: options.workerId,
        leaseExpiresAt, lastTick: runtime.state.root.tick, lastSnapshotAt: snapshot?.createdAt ?? null,
        lastErrorCode: null, at: at.toISOString() });
    }
  };

  const ensureRuntime = async (record: HostedServerRecord, restoreLatest = false) => {
    const existing = options.server.instanceManager.getInstanceById(record.serverInstanceId);
    if (existing) {
      if (restoreLatest) await options.server.instanceManager.restoreInstance(record.serverInstanceId);
      syncRuntimeStatus(existing, record);
      return existing;
    }
    const creation = options.server.serverInstanceCreationService.createGameServerInstanceResult({
      serverInstanceId: record.serverInstanceId,
      mode: record.mode,
      displayName: record.displayName,
      region: record.region,
      capacity: record.capacity,
      mapComposition: record.mapComposition as never,
      joinPolicy: record.joinPolicy === "open" ? "open" : "closed",
      worldSeed: record.worldSeed
    });
    if (!creation.accepted) throw safe("RUNTIME_CREATE_FAILED");
    const snapshot = await options.server.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(record.serverInstanceId);
    if (snapshot) await options.server.instanceManager.restoreInstance(record.serverInstanceId);
    syncRuntimeStatus(creation.runtime, record);
    return creation.runtime;
  };

  const syncRuntimeStatus = (runtime: ServerInstanceRuntime, record: HostedServerRecord): void => {
    runtime.lobby.joinPolicy = record.joinPolicy === "open" ? "open" : "closed";
    if (record.status === "running") options.server.instanceManager.startInstance(record.serverInstanceId);
    else if (record.status === "paused") options.server.instanceManager.pauseInstance(record.serverInstanceId);
    else runtime.record.status = record.status === "stopped" || record.status === "lobby" ? record.status : "lobby";
  };

  const workerAudit = (action: "provisioning-success" | "provisioning-failure" | "lifecycle-success" | "lifecycle-failure",
    target: string, at: string, result: AdminAuditEntryView["result"] = "success"): AdminAuditEntryView => ({
    id: `admin-audit:${crypto.randomUUID()}`, adminSessionId: null, actorId: options.workerId, role: null,
    action, targetInstanceId: target, result, createdAt: at, correlationId: `hosted-worker:${crypto.randomUUID()}`
  });

  return { heartbeat, restoreKnownInstances, runOnce, stop };
};

const safe = (code: string): Error => Object.assign(new Error(code), { safeCode: code });
const safeCode = (error: unknown): string => typeof error === "object" && error !== null && "safeCode" in error
  ? String((error as { safeCode: unknown }).safeCode).slice(0, 80) : "HOSTED_WORKER_OPERATION_FAILED";
