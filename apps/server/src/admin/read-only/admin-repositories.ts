import type {
  AdminAuditEntryView,
  AdminCommandSummaryView,
  AdminDiagnosticSummaryView,
  AdminEventSummaryView,
  AdminInstanceDetailView,
  AdminInstanceSummaryView,
  AdminRole,
  AdminSessionView,
  AdminSnapshotSummaryView
} from "@empire/shared-types";

export interface AdminStoredSession extends AdminSessionView {
  tokenHash: string;
}

export interface AdminWorkerHeartbeatView {
  serverInstanceId: string;
  ownerId: string | null;
  lastHeartbeatAt: string | null;
  leaseExpiresAt: string | null;
}

export interface AdminInstanceMonitoringRepository {
  readonly durable: boolean;
  listKnownInstances(): Promise<AdminInstanceSummaryView[]>;
  getInstanceSummary(serverInstanceId: string): Promise<AdminInstanceSummaryView | null>;
  getInstanceRuntimeProjection(serverInstanceId: string): Promise<AdminInstanceDetailView | null>;
  getInstanceHealth(serverInstanceId: string): Promise<AdminInstanceSummaryView["freshness"] | null>;
  listInstanceCommandSummaries(serverInstanceId: string, limit: number): Promise<AdminCommandSummaryView[]>;
  listInstanceEventSummaries(serverInstanceId: string, limit: number): Promise<AdminEventSummaryView[]>;
  listInstanceDiagnosticSummaries(serverInstanceId: string, limit: number): Promise<AdminDiagnosticSummaryView[]>;
  getWorkerHeartbeat(serverInstanceId: string): Promise<AdminWorkerHeartbeatView | null>;
  getSnapshotMetadata(serverInstanceId: string): Promise<AdminSnapshotSummaryView | null>;
}

export interface AdminSessionRepository {
  readonly durable: boolean;
  createSession(session: AdminStoredSession): Promise<AdminStoredSession>;
  getSessionByTokenHash(tokenHash: string): Promise<AdminStoredSession | null>;
  revokeSession(adminSessionId: string, revokedAt: string): Promise<boolean>;
}

export interface AdminAuditRepository {
  readonly durable: boolean;
  append(entry: AdminAuditEntryView): Promise<void>;
  list(limit: number): Promise<AdminAuditEntryView[]>;
}

export interface AdminLoginRateLimitRepository {
  readonly durable: boolean;
  countRecentFailures(scopeHash: string, since: string): Promise<number>;
  recordFailure(input: {
    id: string;
    fingerprintHash: string;
    actorHash: string;
    createdAt: string;
  }): Promise<void>;
}

export interface AdminDurableRepositories {
  readonly kind: "memory" | "postgres" | "unavailable";
  monitoring: AdminInstanceMonitoringRepository;
  sessions: AdminSessionRepository;
  audit: AdminAuditRepository;
  loginRateLimit: AdminLoginRateLimitRepository;
}

export interface AdminBootstrapIdentity {
  actorId: string;
  displayName: string;
  role: AdminRole;
  authenticationMethod: AdminSessionView["authenticationMethod"];
}
