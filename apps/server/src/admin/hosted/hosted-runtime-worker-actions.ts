import type { AdminAuditAction } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import { InstanceLifecycleService } from "../../runtime/instance-manager/instance-lifecycle-service";
import { resolveReadyPlayerCount } from "../../runtime/lifecycle/hosted-ready-player-count";
import type {
  HostedActionRequestRecord,
  HostedControlPlaneRepository,
  HostedServerRecord
} from "./hosted-control-plane-repository";
import { resolveHostedStartEliminationTick } from "./hosted-lifecycle-action-completion";
import { syncHostedRuntimePacingState } from "./hosted-runtime-worker-state";
import { resolveHostedServerRegistrationState } from "./hosted-server-registration-state";

export interface HostedLifecycleTransition {
  nextStatus: HostedServerRecord["status"];
  nextJoinPolicy: HostedServerRecord["joinPolicy"];
  releaseLease: boolean;
}

export const applyHostedLifecycleAction = async (input: {
  server: HostedServerRecord;
  request: HostedActionRequestRecord;
  runtime: ServerInstanceRuntime;
  controlPlane: HostedControlPlaneRepository;
  now: Date;
  prepareRestart: () => Promise<void>;
  restoreAfterRestart: () => Promise<void>;
}): Promise<HostedLifecycleTransition> => {
  const { server, request, runtime, now } = input;
  if (server.provisioningState !== "ready") throw safe("LIFECYCLE_SERVER_NOT_READY");
  const registration = resolveHostedServerRegistrationState(server, now);
  switch (request.action) {
    case "schedule-registration":
      requireLobby(server);
      if (registration.state === "open" || registration.state === "scheduled") {
        throw safe("SERVER_REGISTRATION_WINDOW_IMMUTABLE");
      }
      if (!request.actionPayload.registrationOpensAt
        || Date.parse(request.actionPayload.registrationOpensAt) <= now.getTime()) {
        throw safe("SERVER_REGISTRATION_SCHEDULE_INVALID");
      }
      closeRuntimeForJoin(runtime);
      return unchanged(server, "closed");
    case "open-registration-now":
      requireLobby(server);
      if (registration.state === "open" || registration.state === "scheduled") {
        throw safe(registration.state === "open" ? "SERVER_REGISTRATION_ALREADY_OPEN" : "SERVER_REGISTRATION_WINDOW_IMMUTABLE");
      }
      openRuntimeForJoin(runtime);
      return unchanged(server, "open");
    case "cancel-registration":
      requireLobby(server);
      if (registration.state !== "scheduled") throw safe("SERVER_REGISTRATION_NOT_SCHEDULED");
      closeRuntimeForJoin(runtime);
      return unchanged(server, "closed");
    case "close-registration-now":
      if (registration.state !== "open") throw safe("SERVER_REGISTRATION_NOT_OPEN");
      closeRuntimeForJoin(runtime);
      return unchanged(server, "closed");
    case "open-joins":
      if (!registration.canCreateMembership || !(server.status === "lobby" || server.status === "running")) {
        throw safe(registration.reasonCode ?? "JOINS_NOT_READY");
      }
      openRuntimeForJoin(runtime);
      return unchanged(server, "open");
    case "close-joins":
      closeRuntimeForJoin(runtime);
      return unchanged(server, "closed");
    case "start": {
      requireLobby(server);
      if (!server.currentSnapshotId) throw safe("SERVER_START_SNAPSHOT_MISSING");
      if (registration.state === "not_scheduled" || registration.state === "scheduled") {
        throw safe("SERVER_START_REGISTRATION_NOT_OPEN");
      }
      if (registration.state === "closed_early") throw safe("SERVER_START_STATE_INVALID");
      const durable = await input.controlPlane.listReadyMemberships(server.serverInstanceId);
      const ready = resolveReadyPlayerCount(durable, runtime.state);
      if (ready.count < server.minimumReadyPlayersToStart) {
        throw safe("SERVER_START_MINIMUM_PLAYERS_NOT_MET");
      }
      applyHostedLifecycleTransition(runtime, request.action);
      syncHostedRuntimePacingState(runtime, {
        ...server,
        effectiveFirstEliminationTick: resolveHostedStartEliminationTick(server)
      });
      return { nextStatus: "running", nextJoinPolicy: registration.state === "open" ? "open" : "closed",
        releaseLease: false };
    }
    case "pause":
      if (server.status !== "running") throw safe("PAUSE_INVALID_STATE");
      applyHostedLifecycleTransition(runtime, request.action);
      return unchanged({ ...server, status: "paused" }, server.joinPolicy);
    case "resume":
      if (server.status !== "paused") throw safe("RESUME_INVALID_STATE");
      applyHostedLifecycleTransition(runtime, request.action);
      return unchanged({ ...server, status: "running" }, server.joinPolicy);
    case "restart":
      if (!(server.status === "running" || server.status === "restarting")) throw safe("RESTART_INVALID_STATE");
      await input.prepareRestart();
      await input.restoreAfterRestart();
      applyHostedLifecycleTransition(runtime, request.action);
      return { nextStatus: "running", nextJoinPolicy: registration.state === "open" ? "open" : "closed",
        releaseLease: false };
    case "stop":
      applyHostedLifecycleTransition(runtime, request.action);
      return { nextStatus: "stopped", nextJoinPolicy: "closed", releaseLease: true };
    case "delete":
      throw safe("LIFECYCLE_STATE_INVALID");
  }
};

export const applyHostedLifecycleTransition = (
  runtime: ServerInstanceRuntime,
  action: HostedActionRequestRecord["action"]
): void => {
  const lifecycle = new InstanceLifecycleService();
  if (action === "start" || action === "resume") lifecycle.start(runtime);
  else if (action === "pause") lifecycle.pause(runtime);
  else if (action === "restart") lifecycle.restart(runtime);
  else if (action === "stop") lifecycle.stop(runtime);
  else if (action === "delete") lifecycle.stop(runtime);
  else if (action === "open-registration-now" || action === "open-joins") openRuntimeForJoin(runtime);
  else closeRuntimeForJoin(runtime);
};

export const synchronizeHostedRuntimeLifecycleDecision = (
  runtime: ServerInstanceRuntime,
  server: HostedServerRecord
): void => {
  syncHostedRuntimePacingState(runtime, server);
  runtime.record.status = hostedRuntimeStatus(server.status);
  runtime.record.startedAt = server.lastStartedAt ?? runtime.record.startedAt;
  runtime.record.stoppedAt = server.lastStoppedAt ?? runtime.record.stoppedAt;
  runtime.lobby.joinPolicy = server.joinPolicy === "open" ? "open" : "closed";
  runtime.scheduler.isRunning = server.status === "running" && runtime.state.root.phase !== "resolved";
  if (server.lastStartedAt && runtime.state.serverInstance.startedAt !== server.lastStartedAt) {
    runtime.state.serverInstance = {
      ...runtime.state.serverInstance,
      startedAt: server.lastStartedAt,
      version: runtime.state.serverInstance.version + 1
    };
    runtime.state.root = {
      ...runtime.state.root,
      version: runtime.state.root.version + 1
    };
  }
};

export const captureHostedRuntimeLifecycle = (runtime: ServerInstanceRuntime) => ({
  state: structuredClone(runtime.state),
  status: runtime.record.status,
  schedulerRunning: runtime.scheduler.isRunning,
  joinPolicy: runtime.lobby.joinPolicy
});

export const restoreHostedRuntimeLifecycle = (
  runtime: ServerInstanceRuntime,
  snapshot: ReturnType<typeof captureHostedRuntimeLifecycle>
): void => {
  runtime.state = snapshot.state;
  runtime.record.status = snapshot.status;
  runtime.scheduler.isRunning = snapshot.schedulerRunning;
  runtime.lobby.joinPolicy = snapshot.joinPolicy;
};

export const hostedLifecycleSuccessAuditAction = (action: HostedActionRequestRecord["action"]): AdminAuditAction => {
  switch (action) {
    case "schedule-registration": return "registration-scheduled";
    case "open-registration-now": return "registration-opened-now";
    case "cancel-registration": return "registration-canceled-before-open";
    case "close-registration-now": return "registration-closed-early";
    case "start": return "server-started";
    default: return "lifecycle-success";
  }
};

export const hostedLifecycleFailureAuditAction = (
  action: HostedActionRequestRecord["action"],
  errorCode: string
): AdminAuditAction => action === "start" && errorCode === "SERVER_START_MINIMUM_PLAYERS_NOT_MET"
  ? "server-start-rejected-minimum-players" : "lifecycle-failure";

const unchanged = (server: HostedServerRecord, joinPolicy: HostedServerRecord["joinPolicy"]): HostedLifecycleTransition => ({
  nextStatus: server.status,
  nextJoinPolicy: joinPolicy,
  releaseLease: false
});
const requireLobby = (server: HostedServerRecord): void => {
  if (server.status !== "lobby") throw safe("SERVER_START_STATE_INVALID");
};
const openRuntimeForJoin = (runtime: ServerInstanceRuntime): void => {
  runtime.lobby.joinPolicy = "open";
  if (runtime.record.status === "full") runtime.record.status = "lobby";
};
const closeRuntimeForJoin = (runtime: ServerInstanceRuntime): void => {
  runtime.lobby.joinPolicy = "closed";
};
const hostedRuntimeStatus = (
  status: HostedServerRecord["status"]
): ServerInstanceRuntime["record"]["status"] => {
  if (status === "running" || status === "restarting" || status === "paused"
    || status === "stopped" || status === "lobby") {
    return status;
  }
  return status === "archived" ? "stopped" : "lobby";
};
const safe = (code: string): Error => Object.assign(new Error(code), { safeCode: code });
