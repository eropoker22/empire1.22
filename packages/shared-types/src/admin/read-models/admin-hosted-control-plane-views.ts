export type AdminUserStatus = "active" | "disabled" | "locked";
export type HostedServerStatus = "requested" | "provisioning" | "lobby" | "running" | "restarting" | "paused" | "stopped" | "failed" | "archived";
export type HostedProvisioningState = "requested" | "provisioning" | "ready" | "failed";
export type HostedJoinPolicy = "closed" | "invite_only" | "open";
export type HostedLifecycleAction = "open-joins" | "close-joins" | "start" | "pause" | "resume" | "restart" | "stop";

export interface HostedMapCompositionView {
  downtown: number;
  commercial: number;
  residential: number;
  industrial: number;
  park: number;
}

export interface AdminCreateServerRequestView {
  mode: "free" | "war";
  displayName: string;
  region: string;
  capacity: number;
  joinPolicy: HostedJoinPolicy;
  mapComposition: HostedMapCompositionView;
}

export interface AdminHostedServerView {
  serverInstanceId: string;
  mode: "free" | "war";
  displayName: string;
  region: string;
  capacity: number;
  status: HostedServerStatus;
  joinPolicy: HostedJoinPolicy;
  provisioningState: HostedProvisioningState;
  version: number;
  lastWorkerHeartbeatAt: string | null;
  runtimeLeaseOwnerId: string | null;
  runtimeLeaseExpiresAt: string | null;
  currentSnapshotId: string | null;
  lastErrorCode: string | null;
  committedPlayers?: number;
  reservedSlots?: number;
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
  unavailableCode: string | null;
  servers: AdminHostedServerView[];
}
