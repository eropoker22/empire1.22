import {
  HOSTED_WORKER_FRESH_MS,
  type HostedControlPlaneRepository,
  type HostedServerRecord,
  type HostedWorkerHeartbeatRecord
} from "./hosted-control-plane-repository";
import { copyInMemoryHostedValue as copy } from "./in-memory-hosted-control-plane-utils";

type InMemoryHostedRuntimeRepository = Pick<HostedControlPlaneRepository,
  "writeWorkerHeartbeat" | "getFreshWorkerHeartbeat" | "acquireRuntimeLease" |
  "isRuntimeLeaseCurrent" | "releaseRuntimeLease" | "writeInstanceHeartbeat">;

export const createInMemoryHostedRuntimeRepository = (state: {
  servers: Map<string, HostedServerRecord>;
  runtimeLeaseIncarnations: Map<string, string>;
  workers: Map<string, HostedWorkerHeartbeatRecord>;
}): InMemoryHostedRuntimeRepository => ({
  writeWorkerHeartbeat: async (record, allowIncarnationTakeover = false) => {
    const current = state.workers.get(record.workerId);
    const sameIncarnation = current?.workerIncarnationId === record.workerIncarnationId &&
      current.startedAt === record.startedAt;
    if (current && ((!sameIncarnation && (!allowIncarnationTakeover || current.startedAt > record.startedAt)) ||
      (sameIncarnation && current.lastHeartbeatAt > record.lastHeartbeatAt))) return;
    state.workers.set(record.workerId, copy(record));
  },
  getFreshWorkerHeartbeat: async (since) => copy([...state.workers.values()]
    .filter((entry) => entry.status === "online" && entry.lastHeartbeatAt >= since)
    .sort((a, b) => b.lastHeartbeatAt.localeCompare(a.lastHeartbeatAt))[0] ?? null),
  acquireRuntimeLease: async (input) => {
    const server = state.servers.get(input.serverInstanceId);
    const worker = state.workers.get(input.workerId);
    const sameIncarnation = server?.runtimeLeaseOwnerId === input.workerId &&
      state.runtimeLeaseIncarnations.get(input.serverInstanceId) === input.workerIncarnationId;
    const expired = !server?.runtimeLeaseExpiresAt || server.runtimeLeaseExpiresAt <= input.now;
    if (!server || worker?.workerIncarnationId !== input.workerIncarnationId || worker.status !== "online" ||
      new Date(worker.lastHeartbeatAt).getTime() <= new Date(input.now).getTime() - HOSTED_WORKER_FRESH_MS ||
      input.expiresAt <= input.now || (!sameIncarnation && !expired)) return false;
    state.runtimeLeaseIncarnations.set(input.serverInstanceId, input.workerIncarnationId);
    Object.assign(server, { runtimeLeaseOwnerId: input.workerId, runtimeLeaseExpiresAt: input.expiresAt,
      lastWorkerHeartbeatAt: input.now });
    return true;
  },
  isRuntimeLeaseCurrent: async (input) => {
    const server = state.servers.get(input.serverInstanceId);
    return Boolean(server?.runtimeLeaseOwnerId === input.workerId && server.runtimeLeaseExpiresAt &&
      server.runtimeLeaseExpiresAt > input.at &&
      state.runtimeLeaseIncarnations.get(input.serverInstanceId) === input.workerIncarnationId);
  },
  releaseRuntimeLease: async (id, workerId, workerIncarnationId, at) => {
    const server = state.servers.get(id);
    if (server?.runtimeLeaseOwnerId !== workerId ||
      state.runtimeLeaseIncarnations.get(id) !== workerIncarnationId || server.status === "running") return;
    state.runtimeLeaseIncarnations.delete(id);
    Object.assign(server, { runtimeLeaseOwnerId: null, runtimeLeaseExpiresAt: null, updatedAt: at });
  },
  writeInstanceHeartbeat: async (input) => {
    const server = state.servers.get(input.serverInstanceId);
    if (server?.runtimeLeaseOwnerId !== input.workerId ||
      state.runtimeLeaseIncarnations.get(input.serverInstanceId) !== input.workerIncarnationId ||
      !server.runtimeLeaseExpiresAt || server.runtimeLeaseExpiresAt <= input.at ||
      input.leaseExpiresAt <= input.at) return;
    Object.assign(server, { lastWorkerHeartbeatAt: input.at, runtimeLeaseExpiresAt: input.leaseExpiresAt });
  }
});
