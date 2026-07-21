export type AdminRole = "viewer" | "operator" | "owner";
export type AdminWorkerStatus = "live" | "stale" | "offline" | "no-worker";
export type AdminDataSource = "durable-control-plane" | "durable-snapshot";

export interface AdminFreshnessView {
  serverInstanceId: string;
  generatedAt: string;
  source: AdminDataSource;
  dataAsOf: string | null;
  lastSnapshotAt: string | null;
  lastHeartbeatAt: string | null;
  stale: boolean;
  staleReason: string | null;
}

export interface AdminSessionView {
  adminSessionId: string;
  adminUserId: string;
  actorId: string;
  username: string;
  displayName: string;
  role: AdminRole;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string;
  authenticationMethod: "password" | "closed-alpha-bootstrap" | "production-identity";
}

export interface AdminInstanceSummaryView {
  serverInstanceId: string;
  displayName: string;
  mode: string;
  region: string;
  capacity: number;
  joinPolicy: string;
  status: string;
  currentTick: number | null;
  stateVersion: number | null;
  playerCount: number;
  workerStatus: AdminWorkerStatus;
  lastHeartbeatAt: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastSnapshotAt: string | null;
  snapshotStale: boolean;
  lastErrorAt: string | null;
  freshness: AdminFreshnessView;
}

export interface AdminOverviewView {
  generatedAt: string;
  databaseStatus: "available";
  instances: AdminInstanceSummaryView[];
  counts: {
    known: number;
    live: number;
    stale: number;
    offline: number;
    noWorker: number;
    failed: number;
    running: number;
    lobby: number;
    paused: number;
    players: number;
  };
}

export interface AdminPlayerSummaryView {
  serverInstanceId: string;
  playerId: string;
  displayName: string;
  factionId: string;
  status: string;
  homeDistrictId: string | null;
  ownedDistrictCount: number;
  cash: number;
  dirtyCash: number;
  population: number;
  heat: number;
  wantedLevel: number;
  lastActionAt: string | null;
}

export interface AdminDistrictSummaryView {
  serverInstanceId: string;
  districtId: string;
  name: string;
  zone: string;
  status: string;
  ownerPlayerId: string | null;
  influence: number;
  heat: number;
  buildingCount: number;
}

export interface AdminEconomySummaryView {
  serverInstanceId: string;
  totalCleanCash: number;
  totalDirtyCash: number;
  totalResources: Record<string, number>;
}

export interface AdminProductionSummaryView {
  serverInstanceId: string;
  productionBuildingCount: number;
  readyToCollectCount: number;
  activeCraftCount: number;
  storageFullCount: number;
}

export interface AdminPoliceSummaryView {
  serverInstanceId: string;
  heatPressure: "none" | "low" | "medium" | "high" | "extreme";
  maxPlayerHeat: number;
  wantedPlayerCount: number;
  pendingRaidCount: number;
}

export interface AdminLivenessSummaryView {
  serverInstanceId: string;
  activePlayers: number;
  playablePlayers: number;
  temporarilySealedPlayers: number;
  encircledPlayers: number;
  lastStandPlayers: number;
  emergencyRecoveryEligiblePlayers: number;
  invalidSoftlocks: number;
}

export interface AdminAllianceSummaryView {
  serverInstanceId: string;
  allianceId: string;
  memberCount: number;
}

export interface AdminSnapshotSummaryView {
  serverInstanceId: string;
  snapshotId: string | null;
  createdAt: string | null;
  tick: number | null;
  stateVersion: number | null;
  schemaVersion: number | null;
  stale: boolean;
}

export interface AdminCommandSummaryView {
  serverInstanceId: string;
  commandId: string;
  commandType: string;
  actorId: string;
  status: "recorded";
  receivedAt: string;
  tickAtReceive: number;
}

export interface AdminEventSummaryView {
  serverInstanceId: string;
  eventId: string;
  eventType: string;
  causedByCommandId: string | null;
  occurredAt: string;
  tick: number;
}

export interface AdminDiagnosticSummaryView {
  serverInstanceId: string;
  diagnosticId: string;
  level: "info" | "warn" | "error";
  category: string;
  messageCode: string;
  occurredAt: string;
  commandId: string | null;
}

export interface AdminInstanceDetailView {
  serverInstanceId: string;
  generatedAt: string;
  summary: AdminInstanceSummaryView;
  freshness: AdminFreshnessView;
  runtimeAvailable: boolean;
  players: AdminPlayerSummaryView[];
  districts: AdminDistrictSummaryView[];
  economy: AdminEconomySummaryView;
  production: AdminProductionSummaryView;
  police: AdminPoliceSummaryView;
  liveness: AdminLivenessSummaryView;
  alliances: AdminAllianceSummaryView[];
  snapshot: AdminSnapshotSummaryView;
  commands: AdminCommandSummaryView[];
  events: AdminEventSummaryView[];
  diagnostics: AdminDiagnosticSummaryView[];
}

export type AdminAuditAction =
  | "login-success"
  | "login-failure"
  | "logout"
  | "session-expired"
  | "session-revoked"
  | "overview-access"
  | "instance-detail-access"
  | "audit-access"
  | "forbidden-access"
  | "admin-user-bootstrap"
  | "admin-password-rotated"
  | "create-server-request"
  | "create-server-replay"
  | "provisioning-success"
  | "provisioning-failure"
  | "lifecycle-request"
  | "lifecycle-replay"
  | "lifecycle-success"
  | "lifecycle-failure"
  | "registration-scheduled"
  | "registration-opened-now"
  | "registration-canceled-before-open"
  | "registration-closed-automatically"
  | "registration-closed-early"
  | "server-start-requested"
  | "server-start-rejected-minimum-players"
  | "server-started"
  | "effective-lockdown-trigger-frozen";

export interface AdminAuditEntryView {
  id: string;
  adminSessionId: string | null;
  actorId: string | null;
  role: AdminRole | null;
  action: AdminAuditAction;
  targetInstanceId: string | null;
  result: "success" | "failure" | "forbidden";
  createdAt: string;
  correlationId: string;
}

export interface AdminApiErrorView {
  code: string;
  message: string;
}

export type AdminApiResponse<TData> =
  | { accepted: true; data: TData; errors: [] }
  | { accepted: false; data: null; errors: AdminApiErrorView[] };
