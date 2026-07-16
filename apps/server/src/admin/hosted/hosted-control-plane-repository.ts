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

export type HostedCreateTransactionResult =
  | { kind: "created" | "replayed"; server: HostedServerRecord; job: HostedProvisioningJobRecord }
  | { kind: "conflict" };

export type HostedActionTransactionResult =
  | { kind: "created" | "replayed"; request: HostedActionRequestRecord }
  | { kind: "conflict" }
  | { kind: "stale-version" }
  | { kind: "not-found" };

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
  writeWorkerHeartbeat(record: HostedWorkerHeartbeatRecord): Promise<void>;
  getFreshWorkerHeartbeat(since: string): Promise<HostedWorkerHeartbeatRecord | null>;
  acquireRuntimeLease(input: { serverInstanceId: string; workerId: string; now: string; expiresAt: string }): Promise<boolean>;
  releaseRuntimeLease(serverInstanceId: string, workerId: string, at: string): Promise<void>;
  writeInstanceHeartbeat(input: { serverInstanceId: string; workerId: string; leaseExpiresAt: string; lastTick: number; lastSnapshotAt: string | null; lastErrorCode: string | null; at: string }): Promise<void>;
}
