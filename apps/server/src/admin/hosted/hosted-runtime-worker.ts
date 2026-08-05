import type { ServerApp } from "../../app/server-app";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import { withInstanceCommandLock } from "../../runtime/instance-manager/instance-command-lock";
import { restoreRuntimeFromSnapshot } from "../../runtime/persistence";
import type { PostgresPlayerEntryRepository } from "../../player-entry/postgres-player-entry-repository";
import type { HostedControlPlaneRepository, HostedServerRecord } from "./hosted-control-plane-repository";
import { createHostedInstanceFailureReporter, createHostedWorkerAudit,
  isSnapshotForHostedRecord, syncHostedRuntimeStatus } from "./hosted-runtime-worker-state";
import { applyHostedLifecycleAction, applyHostedLifecycleTransition, hostedLifecycleFailureAuditAction,
  hostedLifecycleSuccessAuditAction, synchronizeHostedRuntimeLifecycleDecision } from "./hosted-runtime-worker-actions";
import { createHostedRuntimeLeaseClient } from "./hosted-runtime-lease-client";
import { processHostedRuntimeJoinJob } from "./hosted-runtime-join-job";
import { createHostedRuntimeMaintenanceTask } from "./hosted-runtime-maintenance-task";
import { processHostedRuntimeMembershipJob } from "./hosted-runtime-membership-job";
import {
  createHostedRuntimeMutationStage,
  type HostedRuntimePlayerMutationOptions
} from "./hosted-runtime-player-mutation-context";
import {
  createHostedLifecycleSnapshotWrite,
  createHostedProvisioningSnapshotWrite,
  isHostedLifecycleSnapshotAction,
  runHostedSnapshotMaintenance,
  saveHostedLifecycleCheckpoint,
  saveHostedProvisioningCheckpoint
} from "./hosted-runtime-snapshot-persistence";
import type { HostedRuntimeMutationCommitter } from "./postgres-hosted-runtime-mutation-committer";
const CLAIM_TTL_MS = 30_000;
const RUNTIME_LEASE_MS = 20_000;
interface HostedRuntimeWorkerOptions {
  workerId: string;
  region: string;
  buildSha: string;
  controlPlane: HostedControlPlaneRepository;
  server: ServerApp;
  playerEntry?: PostgresPlayerEntryRepository;
  now?: () => Date;
  workerIncarnationId?: string;
  runtimeMutationCommitter?: HostedRuntimeMutationCommitter;
}

export const createHostedRuntimeWorker = (options: HostedRuntimeWorkerOptions) => {
  const now = options.now ?? (() => new Date());
  const lease = createHostedRuntimeLeaseClient({ ...options, now });
  const workerAudit = createHostedWorkerAudit(options.workerId);
  const maintenanceTask = createHostedRuntimeMaintenanceTask((nowIso) => runHostedSnapshotMaintenance(options.server, nowIso));
  const startedAt = now().toISOString();
  let stopped = false, drainRequested = false, heartbeatRegistered = false;
  const requestDrain = (): void => { drainRequested = true; };
  const reportInstanceFailure = createHostedInstanceFailureReporter({
    writeInstanceHeartbeat: lease.writeInstanceHeartbeat,
    instanceManager: options.server.instanceManager,
    now
  });
  const heartbeat = async (status: "online" | "draining" | "stopped" | "failed" = "online") => {
    await options.controlPlane.writeWorkerHeartbeat({ workerId: options.workerId, workerIncarnationId: lease.workerIncarnationId, region: options.region,
      buildSha: options.buildSha, startedAt, lastHeartbeatAt: now().toISOString(), status }, !heartbeatRegistered);
    heartbeatRegistered = true;
  };
  const restoreKnownInstances = async (): Promise<void> => {
    const servers = await options.controlPlane.listServers();
    for (const record of servers.filter((entry) => entry.provisioningState === "ready"
      && (entry.status === "restarting" || requiresPeriodicRuntimeWork(entry)))) {
      const at = now();
      const leaseExpiresAt = new Date(at.getTime() + RUNTIME_LEASE_MS).toISOString();
      try {
        if (await lease.acquire(record.serverInstanceId, at.toISOString(), leaseExpiresAt)) {
          await withInstanceCommandLock(record.serverInstanceId, () => ensureRuntime(record, true));
        }
      } catch (error) {
        await reportInstanceFailure(record, leaseExpiresAt, safeCode(error)).catch(() => undefined);
      }
    }
  };
  const runOnce = async (): Promise<void> => {
    const phases: ReadonlyArray<() => Promise<unknown>> = [
      () => heartbeat(),
      () => options.controlPlane.expireJoinReservations(now().toISOString()),
      processProvisioningJob,
      processJoinJob,
      processMembershipJob,
      processAction,
      tickOwnedInstances
    ];
    for (const phase of phases) {
      if (stopped || drainRequested) return;
      await phase();
    }
    if (!stopped && !drainRequested) maintenanceTask.schedule(now().toISOString());
  };
  let playerMutationOptions: HostedRuntimePlayerMutationOptions;
  const processMembershipJob = (): Promise<void> =>
    processHostedRuntimeMembershipJob(playerMutationOptions);
  const processJoinJob = (): Promise<void> =>
    processHostedRuntimeJoinJob(playerMutationOptions);
  const stop = async (): Promise<void> => {
    requestDrain();
    await maintenanceTask.drain();
    if (stopped) return;
    stopped = true;
    await heartbeat("draining");
    for (const runtime of options.server.instanceManager.listInstances()) {
      await lease.release(runtime.record.id, now().toISOString());
    }
    await heartbeat("stopped");
  };
  const processProvisioningJob = async (): Promise<void> => {
    const claimedAt = now();
    const job = await options.controlPlane.claimProvisioningJob(options.workerId, lease.workerIncarnationId, claimedAt.toISOString(),
      new Date(claimedAt.getTime() + CLAIM_TTL_MS).toISOString());
    if (!job) return;
    const claim = { jobId: job.jobId, serverInstanceId: job.serverInstanceId, workerId: options.workerId,
      workerIncarnationId: lease.workerIncarnationId, expectedJobVersion: job.version };
    let provisioningBegan = false;
    let uncommittedRuntimeId: string | null = null;
    try {
      const record = await options.controlPlane.getServer(job.serverInstanceId);
      if (!record) throw safe("PROVISIONING_SERVER_NOT_FOUND");
      const leaseExpiresAt = new Date(claimedAt.getTime() + RUNTIME_LEASE_MS).toISOString();
      if (!await lease.acquire(record.serverInstanceId, claimedAt.toISOString(), leaseExpiresAt)) {
        throw safe("PROVISIONING_LEASE_UNAVAILABLE");
      }
      if (!await options.controlPlane.beginProvisioning({ ...claim, at: claimedAt.toISOString() }))
        throw safe("PROVISIONING_STATE_CONFLICT");
      provisioningBegan = true;
      const snapshotRepository = options.server.instanceManager.getPersistenceRepositories().snapshotRepository;
      const existingSnapshot = await snapshotRepository.loadRecoveryHead(record.serverInstanceId);
      await withInstanceCommandLock(record.serverInstanceId, async () => {
        const existingRuntime = options.server.instanceManager.getInstanceById(record.serverInstanceId);
        const runtime = existingRuntime ?? await ensureRuntime(record, false);
        if (!existingRuntime) uncommittedRuntimeId = record.serverInstanceId;
        const stage = createHostedRuntimeMutationStage(runtime);
        if (existingSnapshot) await stage.restore();
        syncHostedRuntimeStatus(stage.runtime, record, claimedAt);
        stage.runtime.lobby.joinPolicy = "closed";
        stage.runtime.record.status = "lobby";
        if (!existingSnapshot) {
          const mutationCommitter = requireDurableMutationCommitter(options);
          const snapshotWrite = createHostedProvisioningSnapshotWrite(stage.runtime);
          const completionAt = now().toISOString();
          const completion = { ...claim, snapshotId: snapshotWrite.snapshot.snapshotId,
            at: completionAt, audit: workerAudit("provisioning-success", record.serverInstanceId, completionAt) };
          const completed = mutationCommitter
            ? await mutationCommitter.commitProvisioning({
                ...snapshotWrite,
                completion,
                fence: lease.tickFence(record.serverInstanceId)
              })
            : await completeInMemoryProvisioningMutation(options, stage.runtime, completion);
          if (!completed) throw safe("PROVISIONING_CLAIM_LOST");
          await stage.publish();
          uncommittedRuntimeId = null;
          const snapshot = await snapshotRepository.loadRecoveryHead(record.serverInstanceId);
          if (!snapshot) throw safe("INITIAL_SNAPSHOT_MISSING");
          await lease.writeInstanceHeartbeat({ serverInstanceId: record.serverInstanceId,
            leaseExpiresAt, lastTick: stage.runtime.state.root.tick, lastSnapshotAt: snapshot.createdAt,
            lastErrorCode: null, at: completion.at });
          return;
        }
        const at = now().toISOString();
        if (!await options.controlPlane.completeProvisioning({ ...claim, snapshotId: existingSnapshot.snapshotId, at,
          audit: workerAudit("provisioning-success", record.serverInstanceId, at) })) throw safe("PROVISIONING_CLAIM_LOST");
        await stage.publish();
        uncommittedRuntimeId = null;
        await lease.writeInstanceHeartbeat({ serverInstanceId: record.serverInstanceId,
          leaseExpiresAt, lastTick: stage.runtime.state.root.tick, lastSnapshotAt: existingSnapshot.createdAt,
          lastErrorCode: null, at });
      });
    } catch (error) {
      const at = now().toISOString(); const code = safeCode(error);
      if (uncommittedRuntimeId) options.server.instanceManager.destroyInstance(uncommittedRuntimeId);
      if (provisioningBegan) await options.controlPlane.failProvisioning({ ...claim, errorCode: code, at,
        audit: workerAudit("provisioning-failure", job.serverInstanceId, at, "failure") });
      await lease.release(job.serverInstanceId, at);
    }
  };
  const processAction = async (): Promise<void> => {
    const claimedAt = now();
    const request = await options.controlPlane.claimAction(options.workerId, lease.workerIncarnationId, claimedAt.toISOString(),
      new Date(claimedAt.getTime() + CLAIM_TTL_MS).toISOString());
    if (!request) return;
    try {
      const server = await options.controlPlane.getServer(request.serverInstanceId);
      if (!server) throw safe("LIFECYCLE_SERVER_NOT_FOUND");
      if (server.version !== request.expectedVersion) throw safe("LIFECYCLE_STALE_VERSION");
      const leaseAt = now();
      const leaseExpiresAt = new Date(leaseAt.getTime() + RUNTIME_LEASE_MS).toISOString();
      if (!await lease.acquire(server.serverInstanceId, leaseAt.toISOString(), leaseExpiresAt)) {
        throw safe("RUNTIME_LEASE_UNAVAILABLE");
      }
      await withInstanceCommandLock(server.serverInstanceId, async () => {
        const liveRuntime = await ensureRuntime(server, false);
        const stage = createHostedRuntimeMutationStage(liveRuntime);
        await stage.restore();
        syncHostedRuntimeStatus(stage.runtime, server, leaseAt);
        const mutationCommitter = requireDurableMutationCommitter(options);
        const prepareRestart = async () => {
          if (!await options.controlPlane.prepareRuntimeRestart({ serverInstanceId: server.serverInstanceId,
            workerId: options.workerId, workerIncarnationId: lease.workerIncarnationId,
            expectedVersion: request.expectedVersion, at: now().toISOString() })) throw safe("RESTART_STATE_CONFLICT");
        };
        const restoreAfterRestart = async () => {
          await lease.release(server.serverInstanceId, now().toISOString());
          const restartAt = now();
          if (!await lease.acquire(server.serverInstanceId, restartAt.toISOString(),
            new Date(restartAt.getTime() + RUNTIME_LEASE_MS).toISOString())) throw safe("RUNTIME_LEASE_UNAVAILABLE");
        };
        const at = now().toISOString();
        let releaseLease = request.action === "stop";
        let completed = false;
        if (mutationCommitter) {
          if (request.action === "restart") {
            await prepareRestart();
            await restoreAfterRestart();
          }
          const completion = { request, workerIncarnationId: lease.workerIncarnationId,
            nextStatus: server.status, nextJoinPolicy: server.joinPolicy, at,
            audit: workerAudit(hostedLifecycleSuccessAuditAction(request.action), request.serverInstanceId, at) };
          completed = await mutationCommitter.commitAction({
            completion,
            fence: lease.tickFence(request.serverInstanceId),
            createSnapshotWrite: (decision) => {
              applyHostedLifecycleTransition(stage.runtime, request.action);
              synchronizeHostedRuntimeLifecycleDecision(stage.runtime, decision.server);
              return createHostedLifecycleSnapshotWrite(stage.runtime, request.action);
            }
          });
        } else {
          const transition = await applyHostedLifecycleAction({
            server, request, runtime: stage.runtime, controlPlane: options.controlPlane, now: leaseAt,
            prepareRestart, restoreAfterRestart
          });
          releaseLease = transition.releaseLease;
          completed = await options.controlPlane.completeAction({
            request, workerIncarnationId: lease.workerIncarnationId, ...transition, at,
            audit: workerAudit(hostedLifecycleSuccessAuditAction(request.action), request.serverInstanceId, at)
          });
        }
        if (!completed) throw safe("LIFECYCLE_CLAIM_LOST");
        await stage.publish();
        if (!mutationCommitter) {
          await saveHostedLifecycleCheckpoint(options.server, request.serverInstanceId, request.action);
        }
        if (releaseLease) await lease.release(request.serverInstanceId, at);
      });
    } catch (error) {
      const at = now().toISOString();
      const errorCode = safeCode(error);
      await options.controlPlane.failAction({ request, workerIncarnationId: lease.workerIncarnationId, errorCode, at,
        audit: workerAudit(hostedLifecycleFailureAuditAction(request.action, errorCode), request.serverInstanceId, at, "failure") });
    }
  };
  const tickOwnedInstances = async (): Promise<void> => {
    const records = await options.controlPlane.listServers();
    for (const record of records.filter((entry) =>
      entry.provisioningState === "ready" && requiresPeriodicRuntimeWork(entry))) {
      const at = now();
      let leaseExpiresAt = new Date(at.getTime() + RUNTIME_LEASE_MS).toISOString();
      try {
        const owned = await lease.acquire(record.serverInstanceId, at.toISOString(), leaseExpiresAt);
        if (!owned) continue;
        let effectiveRecord = record;
        if (isRegistrationFreezeDue(record, at)) {
          const frozen = await options.controlPlane.freezeRegistrationLifecycle({ serverInstanceId: record.serverInstanceId,
            workerId: options.workerId, workerIncarnationId: lease.workerIncarnationId, expectedVersion: record.version,
            at: at.toISOString(), closedAudit: workerAudit("registration-closed-automatically", record.serverInstanceId, at.toISOString()),
            triggerAudit: workerAudit("effective-lockdown-trigger-frozen", record.serverInstanceId, at.toISOString()) });
          if (frozen.kind === "conflict" || frozen.kind === "not-found") throw safe("RUNTIME_REGISTRATION_FREEZE_CONFLICT");
          if (!frozen.server) throw safe("RUNTIME_REGISTRATION_FREEZE_CONFLICT");
          effectiveRecord = frozen.server;
        }
        await withInstanceCommandLock(effectiveRecord.serverInstanceId, async () => {
          const runtime = await ensureRuntime(effectiveRecord, effectiveRecord.status === "running");
          if (effectiveRecord.status === "running") {
            const tickLeaseAt = now();
            leaseExpiresAt = new Date(tickLeaseAt.getTime() + RUNTIME_LEASE_MS).toISOString();
            if (!await lease.acquire(
              effectiveRecord.serverInstanceId,
              tickLeaseAt.toISOString(),
              leaseExpiresAt
            )) throw safe("RUNTIME_LEASE_UNAVAILABLE");
            await options.server.instanceManager.tickInstanceDurably(
              effectiveRecord.serverInstanceId,
              lease.tickFence(effectiveRecord.serverInstanceId),
              { lockAlreadyHeld: true }
            );
          }
          const snapshot = await options.server.instanceManager.getPersistenceRepositories()
            .snapshotRepository.loadRecoveryHead(effectiveRecord.serverInstanceId);
          if (!snapshot) throw safe("RUNTIME_SNAPSHOT_MISSING");
          if (runtime.record.status === "crashed") throw safe("RUNTIME_TICK_FAILED");
          await lease.writeInstanceHeartbeat({ serverInstanceId: record.serverInstanceId,
            leaseExpiresAt, lastTick: runtime.state.root.tick, lastSnapshotAt: snapshot.createdAt,
            lastErrorCode: null, at: now().toISOString() });
          const defeatedPlayerIds = Object.values(runtime.state.playersById)
            .filter((player) => player.status === "defeated").map((player) => player.id);
          const resolved = runtime.state.root.phase === "resolved";
          const matchResult = resolved ? runtime.state.matchResult : null;
          if (resolved && !matchResult) throw safe("RUNTIME_MATCH_RESULT_MISSING");
          await options.playerEntry?.syncResolvedMemberships(
            record.serverInstanceId,
            defeatedPlayerIds,
            matchResult,
            at.toISOString()
          );
          const revokedPlayerIds = resolved ? Object.keys(runtime.state.playersById) : defeatedPlayerIds;
          await Promise.all(revokedPlayerIds.map((playerId) =>
            options.server.gameplaySessionService.revokePlayerSessions(playerId, at.toISOString())));
          if (resolved) {
            const resolvedAt = now().toISOString();
            if (!await options.controlPlane.finalizeResolvedServer({ serverInstanceId: effectiveRecord.serverInstanceId,
              workerId: options.workerId, workerIncarnationId: lease.workerIncarnationId,
              expectedVersion: effectiveRecord.version, snapshotId: snapshot.snapshotId, at: resolvedAt })) {
              throw safe("RESOLVED_SERVER_CLOSE_CONFLICT");
            }
            runtime.lobby.joinPolicy = "closed";
            runtime.record.status = "stopped";
            runtime.record.stoppedAt = resolvedAt;
            runtime.scheduler.isRunning = false;
          }
        });
      } catch (error) {
        const code = safeCode(error);
        if (code !== "RUNTIME_LEASE_FENCE_REJECTED") {
          await reportInstanceFailure(record, leaseExpiresAt, code).catch(() => undefined);
        }
      }
    }
  };
  const ensureRuntime = async (record: HostedServerRecord, restoreLatest = false) => {
    const existing = options.server.instanceManager.getInstanceById(record.serverInstanceId);
    if (existing && !restoreLatest) {
      syncHostedRuntimeStatus(existing, record, now());
      return existing;
    }
    const snapshotRepository = options.server.instanceManager.getPersistenceRepositories().snapshotRepository;
    const recovery = await snapshotRepository.loadForRecovery(record.serverInstanceId);
    const snapshot = recovery.snapshot;
    if (snapshot && !isSnapshotForHostedRecord(snapshot, record)) throw safe("RUNTIME_SNAPSHOT_INVALID");
    if (record.provisioningState === "ready" && !snapshot) throw safe("RUNTIME_SNAPSHOT_MISSING");
    if (existing) {
      if (snapshot) restoreRuntimeFromSnapshot(existing, snapshot);
      syncHostedRuntimeStatus(existing, record, now());
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
    if (snapshot) restoreRuntimeFromSnapshot(creation.runtime, snapshot);
    syncHostedRuntimeStatus(creation.runtime, record, now());
    return creation.runtime;
  };
  playerMutationOptions = {
    workerId: options.workerId,
    controlPlane: options.controlPlane,
    server: options.server,
    playerEntry: options.playerEntry,
    runtimeMutationCommitter: options.runtimeMutationCommitter,
    now,
    lease,
    ensureRuntime
  };
  return { heartbeat, restoreKnownInstances, requestDrain, runOnce, stop };
};
const safe = (code: string): Error => Object.assign(new Error(code), { safeCode: code });
const safeCode = (error: unknown): string => typeof error === "object" && error !== null && "safeCode" in error
  ? String((error as { safeCode: unknown }).safeCode).slice(0, 80) : "HOSTED_WORKER_OPERATION_FAILED";
const requireDurableMutationCommitter = (
  options: HostedRuntimeWorkerOptions
): HostedRuntimeMutationCommitter | null => {
  if (options.runtimeMutationCommitter) return options.runtimeMutationCommitter;
  if (options.controlPlane.durable) throw safe("HOSTED_MUTATION_COMMITTER_UNAVAILABLE");
  return null;
};

const requiresPeriodicRuntimeWork = (record: HostedServerRecord): boolean =>
  record.status === "running"
  || ((record.status === "lobby" || record.status === "paused")
    && record.registrationClosesAt !== null
    && record.registrationClosedAt === null);

const isRegistrationFreezeDue = (record: HostedServerRecord, at: Date): boolean =>
  record.registrationClosedAt === null
  && record.registrationClosesAt !== null
  && Date.parse(record.registrationClosesAt) <= at.getTime();

const completeInMemoryProvisioningMutation = async (
  options: HostedRuntimeWorkerOptions,
  runtime: ServerInstanceRuntime,
  completion: Parameters<HostedControlPlaneRepository["completeProvisioning"]>[0]
): Promise<boolean> => {
  await options.server.instanceManager.saveInstanceSnapshot(runtime.record.id);
  await saveHostedProvisioningCheckpoint(options.server, runtime.record.id);
  return options.controlPlane.completeProvisioning(completion);
};
