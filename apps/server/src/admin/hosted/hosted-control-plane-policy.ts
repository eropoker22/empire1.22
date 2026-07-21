import {
  FREE_HOSTED_SERVER_LIFECYCLE_POLICY,
  FREE_HOSTED_SERVER_TEMPLATE_POLICIES,
  resolveModeConfig
} from "@empire/game-config";
import type {
  AdminApiErrorView,
  AdminCreateServerRequestView,
  AdminHostedServerView,
  AdminLifecycleActionRequestView
} from "@empire/shared-types";
import { validateServerMapComposition } from "../../bootstrap/gameplay-slice-shared-city-seed";
import { HOSTED_WORKER_FRESH_MS, type HostedServerRecord } from "./hosted-control-plane-repository";
import { resolveHostedServerRegistrationState } from "./hosted-server-registration-state";

const ALLOWED_REGIONS = new Set(["eu-central"]);
const CREATE_KEYS = new Set(["mode", "serverTemplate", "displayName", "region", "capacity", "joinPolicy", "mapComposition"]);
const ACTION_KEYS = new Set(["action", "expectedVersion", "reason", "registrationOpensAt", "confirmationToken"]);
const ACTIONS = ["open-joins", "close-joins", "schedule-registration", "open-registration-now",
  "cancel-registration", "close-registration-now", "start", "pause", "resume", "restart", "stop"] as const;

export const createHostedLifecycleSnapshot = (mode: "free" | "war", serverTemplate: "control" | "full") => {
  const config = resolveModeConfig(mode);
  const template = FREE_HOSTED_SERVER_TEMPLATE_POLICIES[serverTemplate];
  return {
    minimumReadyPlayersToStart: FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart,
    registrationWindowMinutes: FREE_HOSTED_SERVER_LIFECYCLE_POLICY.registrationWindowMs / 60_000,
    registrationScheduleVersion: 0,
    registrationOpensAt: null,
    registrationClosesAt: null,
    registrationClosedAt: null,
    registrationBaselinePlayers: null,
    canonicalFinalLockdownTrigger: config.balance.finalLockdown?.enabled
      ? config.balance.finalLockdown.triggerActivePlayers : null,
    canonicalFirstEliminationTick: template.eliminationEnabled && config.balance.elimination?.enabled
      ? config.balance.elimination.firstEliminationTick : null,
    canonicalTickRateMs: template.eliminationEnabled && config.balance.elimination?.enabled ? config.tickRateMs : null,
    effectiveFinalLockdownTrigger: null,
    effectiveFirstEliminationTick: null
  } as const;
};

export const createHostedAdminServerView = (input: {
  server: HostedServerRecord;
  now: Date;
  committedPlayers: number;
  reservedSlots: number;
  readyPlayers: number;
}): AdminHostedServerView => {
  const { server, now, committedPlayers, reservedSlots, readyPlayers } = input;
  const registration = resolveHostedServerRegistrationState(server, now);
  const nowMs = now.getTime();
  const workerFresh = Boolean(server.runtimeLeaseOwnerId && server.runtimeLeaseExpiresAt
    && Date.parse(server.runtimeLeaseExpiresAt) > nowMs && server.lastWorkerHeartbeatAt
    && nowMs - Date.parse(server.lastWorkerHeartbeatAt) <= HOSTED_WORKER_FRESH_MS);
  const startRegistrationValid = registration.state === "open" || registration.state === "closed";
  const canStart = server.provisioningState === "ready" && server.status === "lobby"
    && Boolean(server.currentSnapshotId) && workerFresh && startRegistrationValid
    && readyPlayers >= server.minimumReadyPlayersToStart;
  const statusAllowsJoin = server.status === "lobby" || server.status === "running"
    && FREE_HOSTED_SERVER_LIFECYCLE_POLICY.allowJoinsWhileRunningDuringWindow;
  const full = committedPlayers + reservedSlots >= server.capacity;
  const joinable = server.provisioningState === "ready" && Boolean(server.currentSnapshotId)
    && workerFresh && statusAllowsJoin && registration.canCreateMembership && !full;
  return {
    ...toView(server), committedPlayers, reservedSlots, readyPlayers,
    registrationState: registration.state,
    registrationRemainingMs: registration.remainingMs,
    registrationReasonCode: registration.reasonCode,
    canStart,
    startDisabledReason: canStart ? null : startDisabledReason(server, registration.state, readyPlayers, workerFresh),
    joinable,
    disabledReason: joinable ? null : joinDisabledReason(server, registration.reasonCode, full, workerFresh)
  };
};

export const parseHostedCreateRequest = (value: unknown, environment: Record<string, string | undefined>) => {
  if (!record(value) || Object.keys(value).some((key) => !CREATE_KEYS.has(key))) {
    return reject("ADMIN_CREATE_INVALID", "Server creation request is invalid.");
  }
  const mode = value.mode === "free" || value.mode === "war" ? value.mode : null;
  if (!mode || mode === "war" && !enabled(environment.EMPIRE_WAR_HOSTING_ENABLED)) {
    return reject("ADMIN_MODE_UNAVAILABLE", "Requested mode is unavailable.");
  }
  const displayName = String(value.displayName ?? "").trim();
  if (displayName.length < 3 || displayName.length > 80 || /[<>\u0000-\u001f\u007f]/u.test(displayName)) {
    return reject("ADMIN_DISPLAY_NAME_INVALID", "Display name is invalid.");
  }
  const region = String(value.region ?? "");
  if (!ALLOWED_REGIONS.has(region)) return reject("ADMIN_REGION_INVALID", "Region is invalid.");
  const capacity = Number(value.capacity);
  const config = resolveModeConfig(mode);
  const serverTemplate = value.serverTemplate === "control" || value.serverTemplate === "full"
    ? value.serverTemplate : null;
  if (!serverTemplate) return reject("ADMIN_SERVER_TEMPLATE_INVALID", "Server template is invalid.");
  if (mode === "war" && serverTemplate !== "full") {
    return reject("ADMIN_SERVER_TEMPLATE_INVALID", "War mode requires the full server template.");
  }
  const requiresCanonicalCapacity = FREE_HOSTED_SERVER_TEMPLATE_POLICIES[serverTemplate].capacityPolicy === "canonical_max";
  if (!Number.isInteger(capacity) || capacity < FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart
    || capacity > config.balance.maxPlayersPerServer
    || requiresCanonicalCapacity && capacity !== config.balance.maxPlayersPerServer) {
    return reject("ADMIN_CAPACITY_INVALID", "Capacity is invalid.");
  }
  if (value.joinPolicy !== "closed") return reject("ADMIN_JOIN_POLICY_INVALID", "Servers must be created with joins closed.");
  const composition = record(value.mapComposition) ? {
    downtown: Number(value.mapComposition.downtown), commercial: Number(value.mapComposition.commercial),
    residential: Number(value.mapComposition.residential), industrial: Number(value.mapComposition.industrial),
    park: Number(value.mapComposition.park)
  } : null;
  if (!composition || validateServerMapComposition(composition as never).length) {
    return reject("ADMIN_MAP_INVALID", "Map composition is invalid.");
  }
  return accept<AdminCreateServerRequestView>({ mode, serverTemplate, displayName, region, capacity, joinPolicy: "closed",
    mapComposition: composition as AdminCreateServerRequestView["mapComposition"] });
};

export const parseHostedActionRequest = (value: unknown) => {
  if (!record(value) || Object.keys(value).some((key) => !ACTION_KEYS.has(key))) {
    return reject("ADMIN_ACTION_INVALID", "Lifecycle request is invalid.");
  }
  if (!ACTIONS.includes(value.action as never)) return reject("ADMIN_ACTION_INVALID", "Lifecycle action is invalid.");
  const action = value.action as AdminLifecycleActionRequestView["action"];
  const expectedVersion = Number(value.expectedVersion);
  const reason = String(value.reason ?? "").trim();
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0 || reason.length < 3 || reason.length > 240
    || /[\u0000-\u001f\u007f]/u.test(reason)) return reject("ADMIN_ACTION_INVALID", "Lifecycle request is invalid.");
  const registrationOpensAt = typeof value.registrationOpensAt === "string" ? value.registrationOpensAt : undefined;
  if (action === "schedule-registration" && (!registrationOpensAt || !Number.isFinite(Date.parse(registrationOpensAt)))) {
    return reject("SERVER_REGISTRATION_SCHEDULE_INVALID", "Začátek registrace není platný.");
  }
  if (action !== "schedule-registration" && registrationOpensAt !== undefined) {
    return reject("ADMIN_ACTION_INVALID", "Lifecycle request is invalid.");
  }
  const confirmationToken = typeof value.confirmationToken === "string" ? value.confirmationToken : undefined;
  if (action === "close-registration-now" && confirmationToken !== "CLOSE_REGISTRATION") {
    return reject("ADMIN_ACTION_CONFIRMATION_REQUIRED", "Nouzové uzavření registrace vyžaduje potvrzení.");
  }
  if (action !== "close-registration-now" && confirmationToken !== undefined) {
    return reject("ADMIN_ACTION_INVALID", "Lifecycle request is invalid.");
  }
  return accept<AdminLifecycleActionRequestView>({ action, expectedVersion, reason,
    ...(registrationOpensAt ? { registrationOpensAt } : {}), ...(confirmationToken ? { confirmationToken } : {}) });
};

const startDisabledReason = (server: HostedServerRecord, state: string, ready: number, fresh: boolean): string => {
  if (server.provisioningState !== "ready") return "Server ještě není připravený.";
  if (server.status !== "lobby") return "Server už není ve vstupní lobby.";
  if (!server.currentSnapshotId) return "Server nemá bezpečný runtime snapshot.";
  if (!fresh) return "Server se právě nepodařilo bezpečně připojit k hernímu workeru.";
  if (state === "not_scheduled" || state === "scheduled") return "Registrace na tento server ještě nezačala.";
  if (state === "closed_early") return "Registrace byla nouzově ukončena.";
  if (ready < server.minimumReadyPlayersToStart) return `Server potřebuje alespoň ${server.minimumReadyPlayersToStart} aktivní hráče.`;
  return "Server teď nelze bezpečně spustit.";
};

const joinDisabledReason = (server: HostedServerRecord, reason: string | null, full: boolean, fresh: boolean): string => {
  if (full) return "Server se mezitím zaplnil.";
  if (!fresh) return "Server se právě nepodařilo bezpečně připojit k hernímu workeru.";
  if (reason === "SERVER_REGISTRATION_NOT_OPEN") return "Registrace na tento server ještě nezačala.";
  if (reason === "SERVER_REGISTRATION_CLOSED") return "Registrační okno tohoto serveru už skončilo.";
  if (reason === "SERVER_REGISTRATION_CLOSED_EARLY") return "Registrace byla nouzově ukončena.";
  if (server.status !== "lobby" && server.status !== "running") return "Server teď nepřijímá další hráče.";
  return reason ?? "Server teď nepřijímá další hráče.";
};

const toView = ({ worldSeed: _worldSeed, configVersion: _configVersion, mapComposition: _mapComposition,
  initialSnapshotId: _initialSnapshotId, createdByAdminUserId: _createdBy, lastStartedAt: _started,
  lastPausedAt: _paused, lastStoppedAt: _stopped, ...view }: HostedServerRecord): AdminHostedServerView => view;
const enabled = (value: string | undefined): boolean => String(value).trim().toLowerCase() === "true";
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const accept = <T>(data: T) => ({ accepted: true as const, data, errors: [] as [] });
const reject = (code: string, message: string) => ({ accepted: false as const, data: null,
  errors: [{ code, message } satisfies AdminApiErrorView] });
