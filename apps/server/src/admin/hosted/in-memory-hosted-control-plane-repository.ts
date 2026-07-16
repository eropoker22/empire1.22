import type { HostedControlPlaneRepository, HostedServerRecord, HostedProvisioningJobRecord, HostedActionRequestRecord, HostedWorkerHeartbeatRecord } from "./hosted-control-plane-repository";

export const createInMemoryHostedControlPlaneRepository = (seed: { servers?: HostedServerRecord[] } = {}): HostedControlPlaneRepository => {
  const servers = new Map((seed.servers ?? []).map((entry) => [entry.serverInstanceId, { ...entry }]));
  const jobs = new Map<string, HostedProvisioningJobRecord>();
  const actions = new Map<string, HostedActionRequestRecord>();
  const workers = new Map<string, HostedWorkerHeartbeatRecord>();
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
      if (server.version !== input.request.expectedVersion) return { kind: "stale-version" };
      idempotency.set(key, { hash: input.requestHash, resourceId: input.request.actionRequestId, action: copy(input.request) });
      actions.set(input.request.actionRequestId, copy(input.request));
      return { kind: "created", request: copy(input.request) };
    },
    claimProvisioningJob: async (workerId, now, until) => {
      const job = [...jobs.values()].find((entry) => entry.availableAt <= now && (entry.status === "pending" || (entry.status === "claimed" && (entry.claimedUntil ?? "") <= now)));
      if (!job) return null;
      Object.assign(job, { status: "claimed", claimedByWorkerId: workerId, claimedUntil: until, attempt: job.attempt + 1, version: job.version + 1, updatedAt: now });
      return copy(job);
    },
    beginProvisioning: async (jobId, serverInstanceId, at) => {
      const job = jobs.get(jobId); const server = servers.get(serverInstanceId);
      if (!job || !server || !(["requested", "provisioning"] as string[]).includes(server.provisioningState)) return false;
      Object.assign(server, { status: "provisioning", provisioningState: "provisioning", joinPolicy: "closed", updatedAt: at, version: server.version + 1 });
      return true;
    },
    completeProvisioning: async (input) => {
      const server = servers.get(input.serverInstanceId); const job = jobs.get(input.jobId);
      if (!server || !job) throw new Error("Provisioning resource was not found.");
      if (server.initialSnapshotId && server.initialSnapshotId !== input.snapshotId) throw new Error("Initial snapshot is immutable.");
      Object.assign(server, { status: "lobby", provisioningState: "ready", joinPolicy: "closed", initialSnapshotId: input.snapshotId, currentSnapshotId: input.snapshotId, lastErrorCode: null, updatedAt: input.at, version: server.version + 1 });
      Object.assign(job, { status: "completed", claimedUntil: null, updatedAt: input.at, version: job.version + 1 });
    },
    failProvisioning: async (input) => {
      const server = servers.get(input.serverInstanceId); const job = jobs.get(input.jobId);
      if (server) Object.assign(server, { status: "failed", provisioningState: "failed", joinPolicy: "closed", lastErrorCode: input.errorCode, updatedAt: input.at, version: server.version + 1 });
      if (job) Object.assign(job, { status: "failed", claimedUntil: null, lastErrorCode: input.errorCode, updatedAt: input.at, version: job.version + 1 });
    },
    claimAction: async (workerId, now, until) => {
      const request = [...actions.values()].find((entry) => entry.status === "requested" || (entry.status === "processing" && (entry.claimedUntil ?? "") <= now));
      if (!request) return null;
      Object.assign(request, { status: "processing", claimedByWorkerId: workerId, claimedUntil: until, updatedAt: now, version: request.version + 1 });
      return copy(request);
    },
    prepareRuntimeRestart: async (input) => {
      const server = servers.get(input.serverInstanceId);
      if (!server || server.runtimeLeaseOwnerId !== input.workerId || server.version !== input.expectedVersion ||
        !(server.status === "running" || server.status === "restarting")) return false;
      Object.assign(server, { status: "restarting", joinPolicy: "closed", updatedAt: input.at });
      return true;
    },
    completeAction: async (input) => {
      const server = servers.get(input.request.serverInstanceId); const request = actions.get(input.request.actionRequestId);
      if (!server || !request) throw new Error("Lifecycle resource was not found.");
      if (server.version !== input.request.expectedVersion) throw new Error("Lifecycle request has a stale server version.");
      Object.assign(server, { status: input.nextStatus, joinPolicy: input.nextJoinPolicy, updatedAt: input.at, version: server.version + 1 });
      Object.assign(request, { status: "completed", claimedUntil: null, updatedAt: input.at, version: request.version + 1 });
    },
    failAction: async (input) => {
      const request = actions.get(input.request.actionRequestId);
      const server = servers.get(input.request.serverInstanceId);
      if (server?.status === "restarting") Object.assign(server, { status: "failed", joinPolicy: "closed",
        runtimeLeaseOwnerId: null, runtimeLeaseExpiresAt: null, lastErrorCode: input.errorCode,
        updatedAt: input.at, version: server.version + 1 });
      if (request) Object.assign(request, { status: "failed", claimedUntil: null, lastErrorCode: input.errorCode,
        updatedAt: input.at, version: request.version + 1 });
    },
    writeWorkerHeartbeat: async (record) => { workers.set(record.workerId, copy(record)); },
    getFreshWorkerHeartbeat: async (since) => copy([...workers.values()].filter((entry) => entry.status === "online" && entry.lastHeartbeatAt >= since).sort((a, b) => b.lastHeartbeatAt.localeCompare(a.lastHeartbeatAt))[0] ?? null),
    acquireRuntimeLease: async (input) => { const server = servers.get(input.serverInstanceId); if (!server || (server.runtimeLeaseOwnerId !== input.workerId && server.runtimeLeaseExpiresAt && server.runtimeLeaseExpiresAt > input.now)) return false; Object.assign(server, { runtimeLeaseOwnerId: input.workerId, runtimeLeaseExpiresAt: input.expiresAt, lastWorkerHeartbeatAt: input.now }); return true; },
    releaseRuntimeLease: async (id, workerId, at) => { const server = servers.get(id); if (server?.runtimeLeaseOwnerId === workerId) Object.assign(server, { runtimeLeaseOwnerId: null, runtimeLeaseExpiresAt: null, updatedAt: at }); },
    writeInstanceHeartbeat: async (input) => { const server = servers.get(input.serverInstanceId); if (server?.runtimeLeaseOwnerId === input.workerId) Object.assign(server, { lastWorkerHeartbeatAt: input.at, runtimeLeaseExpiresAt: input.leaseExpiresAt, lastErrorCode: input.lastErrorCode }); }
  };
};

const copy = <T>(value: T): T => value == null ? value : structuredClone(value);
