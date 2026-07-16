import type {
  AdminAuditEntryView,
  AdminCommandSummaryView,
  AdminDiagnosticSummaryView,
  AdminEventSummaryView,
  AdminInstanceDetailView,
  AdminInstanceSummaryView,
  AdminRole,
  AdminSessionView,
  AdminUserStatus,
  AdminSnapshotSummaryView
} from "@empire/shared-types";
import type { HostedControlPlaneRepository } from "../hosted/hosted-control-plane-repository";

export interface AdminStoredSession extends AdminSessionView {
  tokenHash: string;
  passwordVersion: number;
}

export interface AdminUserRecord {
  adminUserId: string;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  passwordSalt: string;
  passwordAlgorithm: "scrypt";
  passwordParameters: { cost: number; blockSize: number; parallelization: number; keyLength: number; maxMemory: number };
  passwordVersion: number;
  role: AdminRole;
  status: AdminUserStatus;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  passwordChangedAt: string;
  version: number;
}

export interface AdminUserRepository {
  readonly durable: boolean;
  getByNormalizedUsername(normalizedUsername: string): Promise<AdminUserRecord | null>;
  getById(adminUserId: string): Promise<AdminUserRecord | null>;
  create(user: AdminUserRecord): Promise<AdminUserRecord>;
  updateProfileAndRole(input: Pick<AdminUserRecord, "adminUserId" | "username" | "normalizedUsername" | "displayName" | "role" | "status" | "updatedAt">): Promise<AdminUserRecord>;
  rotatePassword(input: Pick<AdminUserRecord, "adminUserId" | "passwordHash" | "passwordSalt" | "passwordAlgorithm" | "passwordParameters" | "passwordChangedAt" | "updatedAt">): Promise<AdminUserRecord>;
  recordLogin(adminUserId: string, at: string): Promise<void>;
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
  revokeSessionsForUser(adminUserId: string, revokedAt: string, exceptSessionId?: string): Promise<number>;
  touchSession(adminSessionId: string, lastSeenAt: string): Promise<void>;
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
    usernameHash: string;
    combinationHash: string;
    createdAt: string;
  }): Promise<void>;
  clearFailures(usernameHash: string, combinationHash: string): Promise<void>;
}

export interface AdminDurableRepositories {
  readonly kind: "memory" | "postgres" | "unavailable";
  monitoring: AdminInstanceMonitoringRepository;
  users: AdminUserRepository;
  sessions: AdminSessionRepository;
  audit: AdminAuditRepository;
  loginRateLimit: AdminLoginRateLimitRepository;
  hosted: HostedControlPlaneRepository;
}
