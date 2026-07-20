import type { HostedControlPlaneRepository, HostedServerRecord, HostedProvisioningJobRecord, HostedActionRequestRecord, HostedWorkerHeartbeatRecord, HostedJoinReservationRecord, HostedJoinJobRecord } from "./hosted-control-plane-repository";
import { createInMemoryHostedJoinRepository } from "./in-memory-hosted-join-repository";
import { createInMemoryHostedRuntimeRepository } from "./in-memory-hosted-runtime-repository";
import {
  copyInMemoryHostedValue as copy,
  isCurrentInMemoryHostedWorker as isCurrentWorker
} from "./in-memory-hosted-control-plane-utils";

export const createInMemoryHostedControlPlaneRepository = (seed: { servers?: HostedServerRecord[] } = {}): HostedControlPlaneRepository => {
  const servers = new Map((seed.servers ?? []).map((entry) => [entry.serverInstanceId, { ...entry }]));
  const runtimeLeaseIncarnations = new Map<string, string>();
  const jobs = new Map<string, HostedProvisioningJobRecord>();
  const provisioningClaimIncarnations = new Map<string, string>();
  const actions = new Map<string, HostedActionRequestRecord>();
  const workers = new Map<string, HostedWorkerHeartbeatRecord>();
  const joinReservations = new Map<string, HostedJoinReservationRecord>();
  const joinJobs = new Map<string, HostedJoinJobRecord>();
  const idempotency = new Map<string, { hash: string; resourceId: string; server?: HostedServerRecord; job?: HostedProvisioningJobRecord; action?: HostedActionRequestRecord }>();
  return {
    durable: false,
    isSchemaCurrent: async () => false,
    listServers: async () => [...servers.values()].map(copy),
    getServer: async (id) => servers.has(id) ? copy(servers.get(id)!) : null,
    createServerTransaction: async (input) => {
      const key = `${input.adminUserId}:create:${input.idempotencyKey}`;
      const existing = idempotency.get(key);
      if (existing) {
        if (existing.hash !== input.requestHash) return { kind: "conflict" };
        if (!existing.server || !existing.job) throw new Error("Idempotency record references an incomplete create transaction.");
        return { kind: "replayed", server: copy(existing.server), job: copy(existing.job) };
      }
      idempotency.set(key, { hash: input.requestHash, resourceId: input.server.serverInstanceId,
        server: copy(input.server), job: copy(input.job) });
      servers.set(input.server.serverInstanceId, copy(input.server)); jobs.set(input.job.jobId, copy(input.job));
      return { kind: "created", server: copy(input.server), job: copy(input.job) };
    },
    enqueueActionTransaction: async (input) => {
      const server = servers.get(input.request.serverInstanceId);
      if (!server) return { kind: "not-found" };
      const key = `${input.request.adminUserId}:action:${input.request.serverInstanceId}:${input.idempotencyKey}`;
      const existing = idempotency.get(key);
      if (existing) {
        if (existing.hash !== input.requestHash) return { kind: "conflict" };
        if (!existing.action) throw new Error("Idempotency record references an incomplete action transaction.");
        return { kind: "replayed", request: copy(existing.action) };
      }
      if (server.provisioningState !== "ready") return { kind: "not-ready" };
      if (server.version !== input.request.expectedVersion) return { kind: "stale-version" };
      idempotency.set(key, { hash: input.requestHash, resourceId: input.request.actionRequestId, action: copy(input.request) });
      actions.set(input.request.actionRequestId, copy(input.request));
      return { kind: "created", request: copy(input.request) };
    },
    claimProvisioningJob: async (workerId, workerIncarnationId, now, until) => {
      if (!isCurrentWorker(workers.get(workerId), workerIncarnationId, now)) return null;
      const job = [...jobs.values()].find((entry) => entry.availableAt <= now && (entry.status === "pending" || (entry.status === "claimed" && (entry.claimedUntil ?? "") <= now)));
      if (!job) return null;
      provisioningClaimIncarnations.set(job.jobId, workerIncarnationId);
      Object.assign(job, { status: "claimed", claimedByWorkerId: workerId, claimedUntil: until, attempt: job.attempt + 1, version: job.version + 1, updatedAt: now });
      return copy(job);
    },
    beginProvisioning: async (input) => {
      const job = jobs.get(input.jobId); const server = servers.get(input.serverInstanceId);
      if (!isCurrentWorker(workers.get(input.workerId), input.workerIncarnationId, input.at) ||
        !isCurrentProvisioningClaim(job, input, provisioningClaimIncarnations.get(input.jobId)) || !server ||
        server.runtimeLeaseOwnerId !== input.workerId ||
        runtimeLeaseIncarnations.get(input.serverInstanceId) !== input.workerIncarnationId ||
        !server.runtimeLeaseExpiresAt || server.runtimeLeaseExpiresAt <= input.at ||
        !(["requested", "provisioning"] as string[]).includes(server.provisioningState)) return false;
      Object.assign(server, { status: "provisioning", provisioningState: "provisioning", joinPolicy: "closed",
        updatedAt: input.at, version: server.version + 1 });
      return true;
    },
    completeProvisioning: async (input) => {
      const server = servers.get(input.serverInstanceId); const job = jobs.get(input.jobId);
      if (!server || !isCurrentWorker(workers.get(input.workerId), input.workerIncarnationId, input.at) ||
        !isCurrentProvisioningClaim(job, input, provisioningClaimIncarnations.get(input.jobId)) ||
        server.runtimeLeaseOwnerId !== input.workerId ||
        runtimeLeaseIncarnations.get(input.serverInstanceId) !== input.workerIncarnationId ||
        !server.runtimeLeaseExpiresAt || server.runtimeLeaseExpiresAt <= input.at ||
        server.provisioningState !== "provisioning") return false;
      if (server.initialSnapshotId && server.initialSnapshotId !== input.snapshotId) throw new Error("Initial snapshot is immutable.");
      Object.assign(server, { status: "lobby", provisioningState: "ready", joinPolicy: "closed", initialSnapshotId: input.snapshotId, currentSnapshotId: input.snapshotId, lastErrorCode: null, updatedAt: input.at, version: server.version + 1 });
      provisioningClaimIncarnations.delete(input.jobId);
      Object.assign(job!, { status: "completed", claimedUntil: null, updatedAt: input.at, version: job!.version + 1 });
      return true;
    },
    failProvisioning: async (input) => {
      const server = servers.get(input.serverInstanceId); const job = jobs.get(input.jobId);
      if (!server || !isCurrentWorker(workers.get(input.workerId), input.workerIncarnationId, input.at) ||
        !isCurrentProvisioningClaim(job, input, provisioningClaimIncarnations.get(input.jobId)) ||
        server.runtimeLeaseOwnerId !== input.workerId ||
        runtimeLeaseIncarnations.get(input.serverInstanceId) !== input.workerIncarnationId ||
        !server.runtimeLeaseExpiresAt || server.runtimeLeaseExpiresAt <= input.at ||
        server.provisioningState !== "provisioning") return false;
      Object.assign(server, { status: "failed", provisioningState: "failed", joinPolicy: "closed", lastErrorCode: input.errorCode, updatedAt: input.at, version: server.version + 1 });
      provisioningClaimIncarnations.delete(input.jobId);
      Object.assign(job!, { status: "failed", claimedUntil: null, lastErrorCode: input.errorCode,
        updatedAt: input.at, version: job!.version + 1 });
      return true;
    },
    claimAction: async (workerId, workerIncarnationId, now, until) => {
      if (!isCurrentWorker(workers.get(workerId), workerIncarnationId, now)) return null;
      const request = [...actions.values()].find((entry) => entry.status === "requested" || (entry.status === "processing" && (entry.claimedUntil ?? "") <= now));
      if (!request) return null;
      Object.assign(request, { status: "processing", claimedByWorkerId: workerId, claimedUntil: until, updatedAt: now, version: request.version + 1 });
      return copy(request);
    },
    prepareRuntimeRestart: async (input) => {
      const server = servers.get(input.serverInstanceId);
      if (!server || server.runtimeLeaseOwnerId !== input.workerId ||
        runtimeLeaseIncarnations.get(input.serverInstanceId) !== input.workerIncarnationId ||
        server.version !== input.expectedVersion ||
        !server.runtimeLeaseExpiresAt || server.runtimeLeaseExpiresAt <= input.at ||
        !(server.status === "running" || server.status === "restarting")) return false;
      Object.assign(server, { status: "restarting", joinPolicy: "closed", updatedAt: input.at });
      return true;
    },
    completeAction: async (input) => {
      const server = servers.get(input.request.serverInstanceId); const request = actions.get(input.request.actionRequestId);
      if (!server || !isCurrentActionClaim(request, input, workers)) return false;
      const workerId = input.request.claimedByWorkerId;
      if (!workerId || server.version !== input.request.expectedVersion || server.runtimeLeaseOwnerId !== workerId ||
        runtimeLeaseIncarnations.get(server.serverInstanceId) !== input.workerIncarnationId ||
        !server.runtimeLeaseExpiresAt || server.runtimeLeaseExpiresAt <= input.at) return false;
      Object.assign(server, { status: input.nextStatus, joinPolicy: input.nextJoinPolicy, lastErrorCode: null,
        updatedAt: input.at, version: server.version + 1 });
      Object.assign(request, { status: "completed", claimedUntil: null, updatedAt: input.at, version: request.version + 1 });
      return true;
    },
    failAction: async (input) => {
      const request = actions.get(input.request.actionRequestId);
      if (!isCurrentActionClaim(request, input, workers)) return false;
      const server = servers.get(input.request.serverInstanceId);
      const workerId = input.request.claimedByWorkerId;
      const currentLease = server?.runtimeLeaseOwnerId === workerId &&
        runtimeLeaseIncarnations.get(server.serverInstanceId) === input.workerIncarnationId &&
        Boolean(server.runtimeLeaseExpiresAt) && server.runtimeLeaseExpiresAt! > input.at;
      const releasedRestart = input.request.action === "restart" && !server?.runtimeLeaseOwnerId &&
        server?.status === "restarting" && server.version === input.request.expectedVersion;
      if (!server || (!currentLease && !releasedRestart)) return false;
      if (input.request.action === "restart" && server.status === "restarting" && server.version === input.request.expectedVersion) {
        runtimeLeaseIncarnations.delete(server.serverInstanceId);
        Object.assign(server, { status: "failed", joinPolicy: "closed", runtimeLeaseOwnerId: null,
          runtimeLeaseExpiresAt: null, lastErrorCode: input.errorCode, updatedAt: input.at, version: server.version + 1 });
      } else Object.assign(server, { lastErrorCode: input.errorCode, updatedAt: input.at });
      Object.assign(request, { status: "failed", claimedUntil: null, lastErrorCode: input.errorCode,
        updatedAt: input.at, version: request.version + 1 });
      return true;
    },
    finalizeResolvedServer: async (input) => {
      const server = servers.get(input.serverInstanceId);
      if (!server || server.provisioningState !== "ready" || server.status !== "running" ||
        server.version !== input.expectedVersion || server.runtimeLeaseOwnerId !== input.workerId ||
        runtimeLeaseIncarnations.get(input.serverInstanceId) !== input.workerIncarnationId ||
        !server.runtimeLeaseExpiresAt || server.runtimeLeaseExpiresAt <= input.at) return false;
      runtimeLeaseIncarnations.delete(input.serverInstanceId);
      Object.assign(server, {
        status: "stopped",
        joinPolicy: "closed",
        currentSnapshotId: input.snapshotId,
        runtimeLeaseOwnerId: null,
        runtimeLeaseExpiresAt: null,
        lastStoppedAt: input.at,
        lastErrorCode: null,
        updatedAt: input.at,
        version: server.version + 1
      });
      return true;
    },
    ...createInMemoryHostedJoinRepository({ servers, joinReservations, joinJobs }),
    ...createInMemoryHostedRuntimeRepository({ servers, runtimeLeaseIncarnations, workers })
  };
};

const isCurrentProvisioningClaim = (
  job: HostedProvisioningJobRecord | undefined,
  input: { workerId: string; workerIncarnationId: string; expectedJobVersion: number; at: string },
  workerIncarnationId: string | undefined
): job is HostedProvisioningJobRecord => Boolean(job && job.status === "claimed" &&
  job.claimedByWorkerId === input.workerId && workerIncarnationId === input.workerIncarnationId &&
  job.version === input.expectedJobVersion &&
  Boolean(job.claimedUntil) && job.claimedUntil! > input.at);

const isCurrentActionClaim = (
  request: HostedActionRequestRecord | undefined,
  input: { request: HostedActionRequestRecord; workerIncarnationId: string; at: string },
  workers: Map<string, HostedWorkerHeartbeatRecord>
): request is HostedActionRequestRecord => Boolean(request && input.request.claimedByWorkerId &&
  isCurrentWorker(workers.get(input.request.claimedByWorkerId), input.workerIncarnationId, input.at) &&
  request.serverInstanceId === input.request.serverInstanceId && request.status === "processing" &&
  request.claimedByWorkerId === input.request.claimedByWorkerId && request.version === input.request.version &&
  Boolean(request.claimedUntil) && request.claimedUntil! > input.at);
