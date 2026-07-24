export type AdminUserStatus = "active" | "disabled" | "locked";
export type HostedServerStatus = "requested" | "provisioning" | "lobby" | "running" | "restarting" | "paused" | "stopped" | "failed" | "archived";
export type HostedProvisioningState = "requested" | "provisioning" | "ready" | "failed";
export type HostedJoinPolicy = "closed" | "invite_only" | "open";
export type HostedServerTemplate = "control" | "full";
export type HostedLifecycleAction =
  | "open-joins"
  | "close-joins"
  | "schedule-registration"
  | "open-registration-now"
  | "cancel-registration"
  | "close-registration-now"
  | "start"
  | "pause"
  | "resume"
  | "restart"
  | "stop";

export type HostedServerRegistrationStatus = "not_scheduled" | "scheduled" | "open" | "closed" | "closed_early";

export type HostedServerRegistrationReasonCode =
  | "SERVER_REGISTRATION_NOT_SCHEDULED"
  | "SERVER_REGISTRATION_NOT_OPEN"
  | "SERVER_REGISTRATION_CLOSED"
  | "SERVER_REGISTRATION_CLOSED_EARLY"
  | "SERVER_REGISTRATION_SCHEDULE_INVALID";

export interface HostedServerRegistrationStateView {
  state: HostedServerRegistrationStatus;
  opensAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  remainingMs: number;
  canCreateMembership: boolean;
  reasonCode: HostedServerRegistrationReasonCode | null;
}

export interface HostedLifecycleActionPayloadView {
  registrationOpensAt?: string;
}

export interface HostedMapCompositionView {
  downtown: number;
  commercial: number;
  residential: number;
  industrial: number;
  park: number;
}

export interface AdminCreateServerRequestView {
  mode: "free" | "war";
  serverTemplate: HostedServerTemplate;
  displayName: string;
  region: string;
  capacity: number;
  joinPolicy: HostedJoinPolicy;
  mapComposition: HostedMapCompositionView;
}

export interface AdminHostedServerView {
  serverInstanceId: string;
  mode: "free" | "war";
  serverTemplate: HostedServerTemplate;
  displayName: string;
  region: string;
  capacity: number;
  status: HostedServerStatus;
  joinPolicy: HostedJoinPolicy;
  provisioningState: HostedProvisioningState;
  minimumReadyPlayersToStart: number;
  registrationWindowMinutes: number;
  registrationScheduleVersion: number;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationClosedAt: string | null;
  registrationBaselinePlayers: number | null;
  canonicalFinalLockdownTrigger: number | null;
  canonicalFirstEliminationTick: number | null;
  canonicalTickRateMs: number | null;
  effectiveFinalLockdownTrigger: number | null;
  effectiveFirstEliminationTick: number | null;
  version: number;
  lastWorkerHeartbeatAt: string | null;
  runtimeLeaseOwnerId: string | null;
  runtimeLeaseExpiresAt: string | null;
  currentSnapshotId: string | null;
  lastErrorCode: string | null;
  committedPlayers?: number;
  reservedSlots?: number;
  readyPlayers?: number;
  registrationState?: HostedServerRegistrationStatus;
  registrationRemainingMs?: number;
  registrationReasonCode?: HostedServerRegistrationReasonCode | null;
  canStart?: boolean;
  startDisabledReason?: string | null;
  joinable?: boolean;
  disabledReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateServerResultView {
  replayed: boolean;
  server: AdminHostedServerView;
  provisioningJobId: string;
}

export interface AdminLifecycleActionRequestView {
  action: HostedLifecycleAction;
  expectedVersion: number;
  reason: string;
  registrationOpensAt?: string;
  confirmationToken?: string;
}

export interface AdminLifecycleActionResultView {
  replayed: boolean;
  actionRequestId: string;
  serverInstanceId: string;
  action: HostedLifecycleAction;
  status: "requested" | "processing" | "completed" | "failed";
  expectedVersion: number;
}

export interface AdminControlPlaneAvailabilityView {
  writesEnabled: boolean;
  provisioningEnabled: boolean;
  databaseAvailable: boolean;
  migrationsCurrent: boolean;
  workerStatus: "online" | "stale" | "offline";
  buildCompatibility?: "current" | "missing" | "mismatch";
  sessionSecurity?: "current" | "blocked" | "not-applicable";
  originPolicy?: "current" | "blocked" | "not-applicable";
  registrationEnabled?: boolean;
  unavailableCode: string | null;
  apiBuildSha?: string | null;
  workerBuildSha?: string | null;
  schemaVersion?: string | null;
  servers: AdminHostedServerView[];
  generatedAt: string;
}
