import type { AdminAuditAction } from "@empire/shared-types";
import type {
  HostedActionRequestRecord,
  HostedServerRecord
} from "./hosted-control-plane-repository";
import { resolveHostedServerRegistrationState } from "./hosted-server-registration-state";

export type HostedLifecycleCompletionError =
  | "LIFECYCLE_SERVER_NOT_READY"
  | "LIFECYCLE_STATE_INVALID"
  | "SERVER_REGISTRATION_SCHEDULE_INVALID"
  | "SERVER_REGISTRATION_WINDOW_IMMUTABLE"
  | "SERVER_REGISTRATION_NOT_OPEN"
  | "SERVER_START_MINIMUM_PLAYERS_NOT_MET"
  | "SERVER_START_SNAPSHOT_MISSING";

export type HostedLifecycleCompletionDecision =
  | { kind: "accepted"; server: HostedServerRecord; auditActions: AdminAuditAction[] }
  | { kind: "rejected"; errorCode: HostedLifecycleCompletionError };

export const resolveHostedLifecycleActionCompletion = (input: {
  server: HostedServerRecord;
  request: HostedActionRequestRecord;
  authoritativeNow: string;
  readyPlayers: number;
  registrationBaselinePlayers?: number;
}): HostedLifecycleCompletionDecision => {
  const { server, request, authoritativeNow } = input;
  if (server.provisioningState !== "ready") return rejected("LIFECYCLE_SERVER_NOT_READY");
  const registration = resolveHostedServerRegistrationState(server, authoritativeNow);
  const next = { ...server, lastErrorCode: null, updatedAt: authoritativeNow, version: server.version + 1 };

  switch (request.action) {
    case "schedule-registration":
      return scheduleRegistration(server, request, authoritativeNow, registration.state);
    case "open-registration-now":
      return openRegistrationNow(server, authoritativeNow, registration.state);
    case "cancel-registration":
      if (server.status !== "lobby" || registration.state !== "scheduled") {
        return rejected("SERVER_REGISTRATION_WINDOW_IMMUTABLE");
      }
      return accepted(resetRegistration(next, "closed"), ["registration-canceled-before-open"]);
    case "close-registration-now":
      if (!(server.status === "lobby" || server.status === "running") || registration.state !== "open") {
        return rejected("SERVER_REGISTRATION_NOT_OPEN");
      }
      return freezeRegistration(next, authoritativeNow, input.registrationBaselinePlayers);
    case "start":
      if (server.status !== "lobby") return rejected("LIFECYCLE_STATE_INVALID");
      if (!server.currentSnapshotId) return rejected("SERVER_START_SNAPSHOT_MISSING");
      const prepared = prepareServerForStart(next, registration.state, input.registrationBaselinePlayers);
      if (!prepared || !registrationAllowsStart(prepared.server, registration.state)) {
        return rejected("SERVER_REGISTRATION_NOT_OPEN");
      }
      if (input.readyPlayers < server.minimumReadyPlayersToStart) {
        return rejected("SERVER_START_MINIMUM_PLAYERS_NOT_MET");
      }
      return accepted({ ...prepared.server, status: "running",
        joinPolicy: registration.state === "open" ? "open" : "closed", lastStartedAt: authoritativeNow },
      [...prepared.auditActions, "server-started"]);
    case "open-joins":
      if (!(server.status === "lobby" || server.status === "running") || registration.state !== "open") {
        return rejected("SERVER_REGISTRATION_NOT_OPEN");
      }
      return accepted({ ...next, joinPolicy: "open" }, []);
    case "close-joins":
      return accepted({ ...next, joinPolicy: "closed" }, []);
    case "pause":
      if (server.status !== "running") return rejected("LIFECYCLE_STATE_INVALID");
      return accepted({ ...next, status: "paused", lastPausedAt: authoritativeNow }, []);
    case "resume":
      if (server.status !== "paused") return rejected("LIFECYCLE_STATE_INVALID");
      return accepted({ ...next, status: "running", joinPolicy: registration.state === "open" ? "open" : "closed" }, []);
    case "restart":
      if (!(server.status === "running" || server.status === "restarting")) return rejected("LIFECYCLE_STATE_INVALID");
      return accepted({ ...next, status: "running", joinPolicy: registration.state === "open" ? "open" : "closed" }, []);
    case "stop":
      return accepted({ ...next, status: "stopped", joinPolicy: "closed", lastStoppedAt: authoritativeNow }, []);
  }
};

export const resolveFrozenHostedLifecycle = (
  server: HostedServerRecord,
  closedAt: string,
  baselinePlayers: number
): Pick<HostedServerRecord, "registrationClosedAt" | "registrationBaselinePlayers"
  | "effectiveFinalLockdownTrigger" | "effectiveFirstEliminationTick"> | null => {
  if (server.canonicalFinalLockdownTrigger === null || baselinePlayers < 0) return null;
  const graceMs = server.lastStartedAt
    ? Math.max(0, Date.parse(closedAt) - Date.parse(server.lastStartedAt)) : 0;
  return {
    registrationClosedAt: closedAt,
    registrationBaselinePlayers: baselinePlayers,
    effectiveFinalLockdownTrigger: Math.min(server.canonicalFinalLockdownTrigger, Math.max(1, baselinePlayers - 1)),
    effectiveFirstEliminationTick: server.canonicalFirstEliminationTick === null || server.canonicalTickRateMs === null
      ? null
      : server.canonicalFirstEliminationTick + Math.ceil(graceMs / server.canonicalTickRateMs)
  };
};

const scheduleRegistration = (
  server: HostedServerRecord,
  request: HostedActionRequestRecord,
  now: string,
  state: string
): HostedLifecycleCompletionDecision => {
  if (server.status !== "lobby" || !canCreateNewWindow(server, state)) {
    return rejected("SERVER_REGISTRATION_WINDOW_IMMUTABLE");
  }
  const opensAt = canonicalFutureTimestamp(request.actionPayload.registrationOpensAt, now);
  if (!opensAt || server.registrationWindowMinutes !== 60) return rejected("SERVER_REGISTRATION_SCHEDULE_INVALID");
  return accepted(beginRegistrationWindow(server, opensAt, "closed", now), ["registration-scheduled"]);
};

const openRegistrationNow = (
  server: HostedServerRecord,
  now: string,
  state: string
): HostedLifecycleCompletionDecision => {
  if (server.status !== "lobby" || !canCreateNewWindow(server, state) || server.registrationWindowMinutes !== 60) {
    return rejected("SERVER_REGISTRATION_WINDOW_IMMUTABLE");
  }
  return accepted(beginRegistrationWindow(server, now, "open", now), ["registration-opened-now"]);
};

const beginRegistrationWindow = (
  server: HostedServerRecord,
  opensAt: string,
  joinPolicy: HostedServerRecord["joinPolicy"],
  now: string
): HostedServerRecord => ({
  ...server,
  registrationOpensAt: opensAt,
  registrationClosesAt: new Date(Date.parse(opensAt) + server.registrationWindowMinutes * 60_000).toISOString(),
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  registrationScheduleVersion: server.registrationScheduleVersion + 1,
  joinPolicy,
  lastErrorCode: null,
  updatedAt: now,
  version: server.version + 1
});

const resetRegistration = (
  server: HostedServerRecord,
  joinPolicy: HostedServerRecord["joinPolicy"]
): HostedServerRecord => ({
  ...server,
  registrationOpensAt: null,
  registrationClosesAt: null,
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  registrationScheduleVersion: server.registrationScheduleVersion + 1,
  joinPolicy,
  lastErrorCode: null
});

const freezeRegistration = (
  server: HostedServerRecord,
  closedAt: string,
  baselinePlayers: number | undefined
): HostedLifecycleCompletionDecision => {
  if (baselinePlayers === undefined) return rejected("LIFECYCLE_STATE_INVALID");
  const frozen = resolveFrozenHostedLifecycle(server, closedAt, baselinePlayers);
  if (!frozen) return rejected("LIFECYCLE_STATE_INVALID");
  return accepted({ ...server, ...frozen, joinPolicy: "closed", lastErrorCode: null },
    ["registration-closed-early", "effective-lockdown-trigger-frozen"]);
};

const canCreateNewWindow = (server: HostedServerRecord, state: string): boolean =>
  state === "not_scheduled" || ((state === "closed" || state === "closed_early")
    && server.registrationClosedAt !== null);

const registrationAllowsStart = (server: HostedServerRecord, state: string): boolean =>
  state === "open" || (state === "closed" && server.registrationClosedAt === server.registrationClosesAt
    && server.effectiveFinalLockdownTrigger !== null);

const prepareServerForStart = (
  server: HostedServerRecord,
  state: string,
  baselinePlayers: number | undefined
): { server: HostedServerRecord; auditActions: AdminAuditAction[] } | null => {
  if (state !== "closed" || server.registrationClosedAt !== null) return { server, auditActions: [] };
  if (!server.registrationClosesAt || baselinePlayers === undefined) return null;
  const frozen = resolveFrozenHostedLifecycle(server, server.registrationClosesAt, baselinePlayers);
  return frozen ? { server: { ...server, ...frozen, joinPolicy: "closed" },
    auditActions: ["registration-closed-automatically", "effective-lockdown-trigger-frozen"] } : null;
};

const canonicalFutureTimestamp = (value: string | undefined, now: string): string | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= Date.parse(now)) return null;
  return new Date(parsed).toISOString();
};

const accepted = (
  server: HostedServerRecord,
  auditActions: AdminAuditAction[]
): HostedLifecycleCompletionDecision => ({ kind: "accepted", server, auditActions });

const rejected = (errorCode: HostedLifecycleCompletionError): HostedLifecycleCompletionDecision =>
  ({ kind: "rejected", errorCode });
