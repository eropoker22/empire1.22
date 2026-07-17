import type {
  AdminAuditEntryView,
  AdminHostedServerView,
  HostedLifecycleAction,
  HostedMapCompositionView
} from "@empire/shared-types";

export interface HostedServerRecord extends AdminHostedServerView {
  worldSeed: string;
  configVersion: number;
  mapComposition: HostedMapCompositionView;
  initialSnapshotId: string | null;
  createdByAdminUserId: string;
  lastStartedAt: string | null;
  lastPausedAt: string | null;
  lastStoppedAt: string | null;
}

export interface HostedProvisioningJobRecord {
  jobId: string;
  serverInstanceId: string;
  attempt: number;
  status: "pending" | "claimed" | "completed" | "failed";
  availableAt: string;
  claimedByWorkerId: string | null;
  claimedUntil: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface HostedActionRequestRecord {
  actionRequestId: string;
  serverInstanceId: string;
  adminUserId: string;
  action: HostedLifecycleAction;
  reason: string;
  expectedVersion: number;
  status: "requested" | "processing" | "completed" | "failed";
  claimedByWorkerId: string | null;
  claimedUntil: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface HostedWorkerHeartbeatRecord {
  workerId: string;
  region: string;
  startedAt: string;
  lastHeartbeatAt: string;
  buildSha: string;
  status: "online" | "draining" | "stopped" | "failed";
}

export interface HostedJoinReservationRecord {
  reservationId: string;
  serverInstanceId: string;
  playerIdentityId: string;
  status: "reserved" | "committed" | "expired" | "canceled" | "rejected";
  idempotencyKey: string;
  requestHash: string;
  expectedServerVersion: number;
  reservedSlot: number;
  factionId: string | null;
  joinTicketId: string | null;
  expiresAt: string;
  createdAt: string;
  committedAt: string | null;
  canceledAt: string | null;
  updatedAt: string;
  version: number;
}

export interface HostedJoinJobRecord {
  jobId: string;
  reservationId: string;
  serverInstanceId: string;
  status: "pending" | "claimed" | "completed" | "failed";
  attempt: number;
  availableAt: string;
  claimedByWorkerId: string | null;
  claimedUntil: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type HostedCreateTransactionResult =
  | { kind: "created" | "replayed"; server: HostedServerRecord; job: HostedProvisioningJobRecord }
  | { kind: "conflict" };

export type HostedActionTransactionResult =
  | { kind: "created" | "replayed"; request: HostedActionRequestRecord }
  | { kind: "conflict" }
  | { kind: "stale-version" }
  | { kind: "not-found" };

export type HostedJoinReservationResult =
  | { kind: "created" | "replayed"; reservation: HostedJoinReservationRecord; job: HostedJoinJobRecord | null }
  | { kind: "conflict" | "server-full" | "not-joinable" | "stale-version" | "not-found" };

export interface HostedControlPlaneRepository {
  readonly durable: boolean;
  isSchemaCurrent(): Promise<boolean>;
  listServers(): Promise<HostedServerRecord[]>;
  getServer(serverInstanceId: string): Promise<HostedServerRecord | null>;
  createServerTransaction(input: {
    server: HostedServerRecord;
    job: HostedProvisioningJobRecord;
    adminUserId: string;
    idempotencyKey: string;
    requestHash: string;
    audit: AdminAuditEntryView;
  }): Promise<HostedCreateTransactionResult>;
  enqueueActionTransaction(input: {
    request: HostedActionRequestRecord;
    idempotencyKey: string;
    requestHash: string;
    audit: AdminAuditEntryView;
  }): Promise<HostedActionTransactionResult>;
  claimProvisioningJob(workerId: string, now: string, claimedUntil: string): Promise<HostedProvisioningJobRecord | null>;
  beginProvisioning(jobId: string, serverInstanceId: string, at: string): Promise<boolean>;
  completeProvisioning(input: { jobId: string; serverInstanceId: string; snapshotId: string; at: string; audit: AdminAuditEntryView }): Promise<void>;
  failProvisioning(input: { jobId: string; serverInstanceId: string; errorCode: string; at: string; audit: AdminAuditEntryView }): Promise<void>;
  claimAction(workerId: string, now: string, claimedUntil: string): Promise<HostedActionRequestRecord | null>;
  prepareRuntimeRestart(input: { serverInstanceId: string; workerId: string; expectedVersion: number; at: string }): Promise<boolean>;
  completeAction(input: { request: HostedActionRequestRecord; nextStatus: HostedServerRecord["status"]; nextJoinPolicy: HostedServerRecord["joinPolicy"]; at: string; audit: AdminAuditEntryView }): Promise<void>;
  failAction(input: { request: HostedActionRequestRecord; errorCode: string; at: string; audit: AdminAuditEntryView }): Promise<void>;
  getJoinReservation(reservationId: string): Promise<HostedJoinReservationRecord | null>;
  getJoinReservationByIdempotency(playerIdentityId: string, idempotencyKey: string): Promise<HostedJoinReservationRecord | null>;
  reserveJoinTransaction(input: {
    reservation: HostedJoinReservationRecord;
    job: HostedJoinJobRecord;
  }): Promise<HostedJoinReservationResult>;
  claimJoinJob(workerId: string, now: string, claimedUntil: string): Promise<HostedJoinJobRecord | null>;
  completeJoin(input: { reservationId: string; jobId: string; workerId: string; joinTicketId: string; at: string }): Promise<boolean>;
  failJoin(input: { reservationId: string; jobId: string; workerId: string; status: "expired" | "canceled" | "rejected"; errorCode: string; at: string }): Promise<void>;
  expireJoinReservations(at: string): Promise<number>;
  getJoinCapacity(serverInstanceId: string, at: string): Promise<{ committedPlayers: number; reservedSlots: number }>;
  writeWorkerHeartbeat(record: HostedWorkerHeartbeatRecord): Promise<void>;
  getFreshWorkerHeartbeat(since: string): Promise<HostedWorkerHeartbeatRecord | null>;
  acquireRuntimeLease(input: { serverInstanceId: string; workerId: string; now: string; expiresAt: string }): Promise<boolean>;
  releaseRuntimeLease(serverInstanceId: string, workerId: string, at: string): Promise<void>;
  writeInstanceHeartbeat(input: { serverInstanceId: string; workerId: string; leaseExpiresAt: string; lastTick: number; lastSnapshotAt: string | null; lastErrorCode: string | null; at: string }): Promise<void>;
}
