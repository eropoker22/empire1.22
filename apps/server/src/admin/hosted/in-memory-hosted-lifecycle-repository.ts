import type {
  HostedActionRequestRecord,
  HostedControlPlaneRepository,
  HostedReadyMembershipRecord,
  HostedServerRecord,
  HostedWorkerHeartbeatRecord
} from "./hosted-control-plane-repository";
import {
  resolveFrozenHostedLifecycle,
  resolveHostedLifecycleActionCompletion
} from "./hosted-lifecycle-action-completion";
import { copyInMemoryHostedValue as copy, isCurrentInMemoryHostedWorker } from "./in-memory-hosted-control-plane-utils";

type LifecycleMethods = Pick<HostedControlPlaneRepository,
  "completeAction" | "failAction" | "freezeRegistrationLifecycle">;

export const createInMemoryHostedLifecycleRepository = (state: {
  servers: Map<string, HostedServerRecord>;
  actions: Map<string, HostedActionRequestRecord>;
  workers: Map<string, HostedWorkerHeartbeatRecord>;
  runtimeLeaseIncarnations: Map<string, string>;
  readyMembershipsByServerId: Map<string, HostedReadyMembershipRecord[]>;
}): LifecycleMethods => ({
  completeAction: async (input) => {
    const server = state.servers.get(input.request.serverInstanceId);
    const request = state.actions.get(input.request.actionRequestId);
    if (!server || !isCurrentActionClaim(request, input, state.workers)) return false;
    const workerId = input.request.claimedByWorkerId;
    if (!workerId || !hasCurrentLease(server, workerId, input.workerIncarnationId,
      input.request.expectedVersion, input.at, state.runtimeLeaseIncarnations)) return false;
    const readyMemberships = state.readyMembershipsByServerId.get(server.serverInstanceId) ?? [];
    const decision = resolveHostedLifecycleActionCompletion({
      server,
      request: input.request,
      authoritativeNow: input.at,
      readyPlayers: readyMemberships.length,
      registrationBaselinePlayers: input.request.action === "close-registration-now" || input.request.action === "start"
        ? readyMemberships.length : undefined
    });
    if (decision.kind === "rejected") {
      Object.assign(server, { lastErrorCode: decision.errorCode, updatedAt: input.at });
      Object.assign(request, { status: "failed", claimedUntil: null, lastErrorCode: decision.errorCode,
        updatedAt: input.at, version: request.version + 1 });
      return false;
    }
    Object.assign(server, decision.server);
    Object.assign(request, { status: "completed", claimedUntil: null, lastErrorCode: null,
      updatedAt: input.at, version: request.version + 1 });
    return true;
  },

  failAction: async (input) => {
    const request = state.actions.get(input.request.actionRequestId);
    if (!isCurrentActionClaim(request, input, state.workers)) return false;
    const server = state.servers.get(input.request.serverInstanceId);
    const workerId = input.request.claimedByWorkerId;
    const currentLease = Boolean(server && workerId && hasCurrentLease(server, workerId,
      input.workerIncarnationId, server.version, input.at, state.runtimeLeaseIncarnations));
    const releasedRestart = input.request.action === "restart" && !server?.runtimeLeaseOwnerId
      && server?.status === "restarting" && server.version === input.request.expectedVersion;
    if (!server || (!currentLease && !releasedRestart)) return false;
    if (input.request.action === "restart" && server.status === "restarting"
      && server.version === input.request.expectedVersion) {
      state.runtimeLeaseIncarnations.delete(server.serverInstanceId);
      Object.assign(server, { status: "failed", joinPolicy: "closed", runtimeLeaseOwnerId: null,
        runtimeLeaseExpiresAt: null, lastErrorCode: input.errorCode, updatedAt: input.at,
        version: server.version + 1 });
    } else {
      Object.assign(server, { lastErrorCode: input.errorCode, updatedAt: input.at });
    }
    Object.assign(request, { status: "failed", claimedUntil: null, lastErrorCode: input.errorCode,
      updatedAt: input.at, version: request.version + 1 });
    return true;
  },

  freezeRegistrationLifecycle: async (input) => {
    const server = state.servers.get(input.serverInstanceId);
    if (!server) return { kind: "not-found", server: null };
    if (!hasCurrentLease(server, input.workerId, input.workerIncarnationId,
      input.expectedVersion, input.at, state.runtimeLeaseIncarnations)) {
      return { kind: "conflict", server: null };
    }
    if (server.registrationClosedAt) return { kind: "already-frozen", server: copy(server) };
    if (!server.registrationClosesAt || server.registrationClosesAt > input.at) {
      return { kind: "not-due", server: copy(server) };
    }
    const baseline = (state.readyMembershipsByServerId.get(server.serverInstanceId) ?? []).length;
    const frozen = resolveFrozenHostedLifecycle(server, server.registrationClosesAt, baseline);
    if (!frozen) return { kind: "conflict", server: null };
    Object.assign(server, { ...frozen, joinPolicy: "closed", lastErrorCode: null,
      updatedAt: input.at, version: server.version + 1 });
    return { kind: "frozen", server: copy(server) };
  }
});

const hasCurrentLease = (
  server: HostedServerRecord,
  workerId: string,
  workerIncarnationId: string,
  expectedVersion: number,
  at: string,
  runtimeLeaseIncarnations: Map<string, string>
): boolean => server.version === expectedVersion && server.runtimeLeaseOwnerId === workerId
  && runtimeLeaseIncarnations.get(server.serverInstanceId) === workerIncarnationId
  && Boolean(server.runtimeLeaseExpiresAt) && server.runtimeLeaseExpiresAt! > at;

const isCurrentActionClaim = (
  request: HostedActionRequestRecord | undefined,
  input: { request: HostedActionRequestRecord; workerIncarnationId: string; at: string },
  workers: Map<string, HostedWorkerHeartbeatRecord>
): request is HostedActionRequestRecord => Boolean(request && input.request.claimedByWorkerId
  && isCurrentInMemoryHostedWorker(workers.get(input.request.claimedByWorkerId), input.workerIncarnationId, input.at)
  && request.serverInstanceId === input.request.serverInstanceId && request.status === "processing"
  && request.claimedByWorkerId === input.request.claimedByWorkerId && request.version === input.request.version
  && Boolean(request.claimedUntil) && request.claimedUntil! > input.at);
