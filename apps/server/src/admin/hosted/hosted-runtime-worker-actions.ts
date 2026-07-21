import type { ServerApp } from "../../app/server-app";
import type { AdminAuditAction } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import { resolveReadyPlayerCount } from "../../runtime/lifecycle/hosted-ready-player-count";
import type {
  HostedActionRequestRecord,
  HostedControlPlaneRepository,
  HostedServerRecord
} from "./hosted-control-plane-repository";
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
  serverApp: ServerApp;
  controlPlane: HostedControlPlaneRepository;
  now: Date;
  prepareRestart: () => Promise<void>;
  restoreAfterRestart: () => Promise<void>;
}): Promise<HostedLifecycleTransition> => {
  const { server, request, runtime, serverApp, now } = input;
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
      serverApp.instanceManager.closeInstanceForJoin(server.serverInstanceId);
      return unchanged(server, "closed");
    case "open-registration-now":
      requireLobby(server);
      if (registration.state === "open" || registration.state === "scheduled") {
        throw safe(registration.state === "open" ? "SERVER_REGISTRATION_ALREADY_OPEN" : "SERVER_REGISTRATION_WINDOW_IMMUTABLE");
      }
      serverApp.instanceManager.openInstanceForJoin(server.serverInstanceId);
      return unchanged(server, "open");
    case "cancel-registration":
      requireLobby(server);
      if (registration.state !== "scheduled") throw safe("SERVER_REGISTRATION_NOT_SCHEDULED");
      serverApp.instanceManager.closeInstanceForJoin(server.serverInstanceId);
      return unchanged(server, "closed");
    case "close-registration-now":
      if (registration.state !== "open") throw safe("SERVER_REGISTRATION_NOT_OPEN");
      serverApp.instanceManager.closeInstanceForJoin(server.serverInstanceId);
      return unchanged(server, "closed");
    case "open-joins":
      if (!registration.canCreateMembership || !(server.status === "lobby" || server.status === "running")) {
        throw safe(registration.reasonCode ?? "JOINS_NOT_READY");
      }
      serverApp.instanceManager.openInstanceForJoin(server.serverInstanceId);
      return unchanged(server, "open");
    case "close-joins":
      serverApp.instanceManager.closeInstanceForJoin(server.serverInstanceId);
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
      serverApp.instanceManager.startInstance(server.serverInstanceId);
      return { nextStatus: "running", nextJoinPolicy: registration.state === "open" ? "open" : "closed",
        releaseLease: false };
    }
    case "pause":
      if (server.status !== "running") throw safe("PAUSE_INVALID_STATE");
      serverApp.instanceManager.pauseInstance(server.serverInstanceId);
      return unchanged({ ...server, status: "paused" }, server.joinPolicy);
    case "resume":
      if (server.status !== "paused") throw safe("RESUME_INVALID_STATE");
      serverApp.instanceManager.startInstance(server.serverInstanceId);
      return unchanged({ ...server, status: "running" }, server.joinPolicy);
    case "restart":
      if (!(server.status === "running" || server.status === "restarting")) throw safe("RESTART_INVALID_STATE");
      await input.prepareRestart();
      await input.restoreAfterRestart();
      return { nextStatus: "running", nextJoinPolicy: registration.state === "open" ? "open" : "closed",
        releaseLease: false };
    case "stop":
      serverApp.instanceManager.stopInstance(server.serverInstanceId);
      return { nextStatus: "stopped", nextJoinPolicy: "closed", releaseLease: true };
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
const safe = (code: string): Error => Object.assign(new Error(code), { safeCode: code });
