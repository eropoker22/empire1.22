import { resolveModeConfig } from "@empire/game-config";
import type {
  AdminInstanceRuntimeHealthView,
  AdminInstanceSummaryView
} from "@empire/shared-types";
import type { AdminSnapshotStorageMetadata } from "./admin-snapshot-storage-metadata";
import type { AdminInstanceTickProgress } from "./admin-instance-tick-observation";
import {
  resolveCommandHealthCheck,
  resolveRuntimeHealthCheck,
  resolveSnapshotHealthCheck,
  resolveTickHealthCheck
} from "./admin-instance-runtime-health-checks";

const HEARTBEAT_LIVE_MS = 30_000;
const RUNNING_STATUSES = new Set(["running", "restarting"]);

export interface AdminRuntimeObservation {
  canonicalTickRateMs: number | null;
  instanceLastTick: number | null;
  instanceLastSnapshotAt: string | null;
  instanceLastErrorCode: string | null;
  lastAppliedCommandAt: string | null;
  lastStartedAt: string | null;
  instanceWorkerId: string | null;
  instanceWorkerIncarnationId: string | null;
  runtimeLeaseIncarnationId: string | null;
}

export const resolveAdminSnapshotFreshnessThresholdMs = (
  mode: string,
  canonicalTickRateMs: number | null
): number => {
  const configuredTickRateMs = positiveInteger(canonicalTickRateMs) ?? configuredTickRate(mode);
  return Math.max(HEARTBEAT_LIVE_MS, configuredTickRateMs * 3);
};

export const resolveAdminTickObservationWindowMs = (
  mode: string,
  canonicalTickRateMs: number | null
): number => {
  const tickRateMs = positiveInteger(canonicalTickRateMs) ?? configuredTickRate(mode);
  return Math.max(HEARTBEAT_LIVE_MS + 5_000, tickRateMs * 4);
};

export const resolveAdminCommandObservationWindowMs = (
  mode: string,
  canonicalTickRateMs: number | null
): number => resolveAdminTickObservationWindowMs(mode, canonicalTickRateMs);

export const requiresActiveInstanceRuntime = (status: string): boolean =>
  RUNNING_STATUSES.has(normalizeStatus(status));

export const isLifecycleSnapshotStale = (input: {
  status: string;
  snapshotAt: string | null;
  generatedAt: string;
  freshnessThresholdMs: number;
}): boolean => {
  if (!requiresActiveInstanceRuntime(input.status)) return false;
  const snapshotAt = timestamp(input.snapshotAt);
  const generatedAt = timestamp(input.generatedAt);
  return snapshotAt === null || generatedAt === null
    || Math.max(0, generatedAt - snapshotAt) > input.freshnessThresholdMs;
};

export const createAdminInstanceRuntimeHealth = (input: {
  summary: AdminInstanceSummaryView;
  generatedAt: string;
  observation: AdminRuntimeObservation;
  snapshotStorage: AdminSnapshotStorageMetadata;
  tickProgress: AdminInstanceTickProgress;
}): AdminInstanceRuntimeHealthView => {
  const status = normalizeStatus(input.summary.status);
  const freshnessThresholdMs = resolveAdminSnapshotFreshnessThresholdMs(
    input.summary.mode,
    input.observation.canonicalTickRateMs
  );
  const commandObservationWindowMs = resolveAdminCommandObservationWindowMs(
    input.summary.mode,
    input.observation.canonicalTickRateMs
  );
  const runtimeExpected = requiresActiveInstanceRuntime(status);
  const leaseActive = Boolean(input.summary.leaseOwner)
    && isFuture(input.summary.leaseExpiresAt, input.generatedAt);
  const heartbeatFresh = input.summary.workerStatus === "live";
  const leaseIdentityMatches = Boolean(input.summary.leaseOwner)
    && input.summary.leaseOwner === input.observation.instanceWorkerId
    && Boolean(input.observation.runtimeLeaseIncarnationId)
    && input.observation.runtimeLeaseIncarnationId === input.observation.instanceWorkerIncarnationId;
  const runtimeActive = resolveRuntimeHealthCheck({
    status,
    runtimeExpected,
    heartbeatFresh,
    leaseIdentityMatches,
    leaseActive,
    leaseOwner: input.summary.leaseOwner,
    leaseExpiresAt: input.summary.leaseExpiresAt,
    lastHeartbeatAt: input.summary.lastHeartbeatAt,
    lastErrorCode: input.observation.instanceLastErrorCode
  });
  const snapshotCurrent = resolveSnapshotHealthCheck({
    status,
    snapshotId: input.summary.lastSnapshotAt ? "recovery-head" : null,
    snapshotAt: input.summary.lastSnapshotAt,
    snapshotStale: isLifecycleSnapshotStale({
      status,
      snapshotAt: input.summary.lastSnapshotAt,
      generatedAt: input.generatedAt,
      freshnessThresholdMs
    }),
    terminalCheckpointCount: input.snapshotStorage.terminalCheckpointCount
  });
  const tickAdvancing = resolveTickHealthCheck({
    status,
    runtimeExpected,
    runtimeActive,
    snapshotCurrent,
    tickProgress: input.tickProgress
  });
  const commandsAccepted = resolveCommandHealthCheck({
    status,
    runtimeExpected,
    runtimeActive,
    generatedAt: input.generatedAt,
    observationWindowMs: commandObservationWindowMs,
    lastAppliedCommandAt: input.observation.lastAppliedCommandAt,
    lastStartedAt: input.observation.lastStartedAt
  });

  return {
    lifecycleStatus: status,
    expectedTickRateMs: positiveInteger(input.observation.canonicalTickRateMs)
      ?? configuredTickRate(input.summary.mode),
    freshnessThresholdMs,
    commandObservationWindowMs,
    instanceLastTick: input.observation.instanceLastTick,
    instanceLastErrorCode: input.observation.instanceLastErrorCode,
    lastAppliedCommandAt: input.observation.lastAppliedCommandAt,
    runtimeActive,
    tickAdvancing,
    snapshotCurrent,
    commandsAccepted
  };
};

const configuredTickRate = (mode: string): number => {
  try {
    return Math.max(1, Math.floor(resolveModeConfig(mode === "war" ? "war" : "free").tickRateMs));
  } catch {
    return 10_000;
  }
};

const positiveInteger = (value: number | null): number | null =>
  Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : null;

const normalizeStatus = (status: string): string => String(status || "unknown").trim().toLowerCase();

const timestamp = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isFuture = (value: string | null, comparedTo: string): boolean => {
  const candidate = timestamp(value);
  const baseline = timestamp(comparedTo);
  return candidate !== null && baseline !== null && candidate > baseline;
};
