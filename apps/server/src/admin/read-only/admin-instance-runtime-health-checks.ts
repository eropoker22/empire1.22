import type { AdminRuntimeHealthCheckView } from "@empire/shared-types";
import type { AdminInstanceTickProgress } from "./admin-instance-tick-observation";

const RUNNING_STATUSES = new Set(["running", "restarting"]);
const IDLE_SNAPSHOT_STATUSES = new Set(["lobby", "paused"]);
const PRE_RUNTIME_STATUSES = new Set(["requested", "provisioning"]);

export const resolveRuntimeHealthCheck = (input: {
  status: string;
  runtimeExpected: boolean;
  heartbeatFresh: boolean;
  leaseIdentityMatches: boolean;
  leaseActive: boolean;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
  lastErrorCode: string | null;
}): AdminRuntimeHealthCheckView => {
  if (!input.runtimeExpected) {
    return check("not-applicable", `runtime-not-required-${input.status}`, input.lastHeartbeatAt);
  }
  if (input.lastErrorCode) return check("fail", "instance-runtime-error", input.lastHeartbeatAt);
  if (!input.heartbeatFresh) return check("fail", "instance-heartbeat-not-live", input.lastHeartbeatAt);
  if (!input.leaseOwner) return check("fail", "runtime-lease-missing", input.lastHeartbeatAt);
  if (!input.leaseIdentityMatches) {
    return check("fail", "runtime-lease-heartbeat-owner-mismatch", input.lastHeartbeatAt);
  }
  if (!input.leaseActive) return check("fail", "runtime-lease-expired", input.leaseExpiresAt);
  return check("pass", "instance-runtime-active", input.lastHeartbeatAt);
};

export const resolveSnapshotHealthCheck = (input: {
  status: string;
  snapshotId: string | null;
  snapshotAt: string | null;
  snapshotStale: boolean;
  terminalCheckpointCount: number;
}): AdminRuntimeHealthCheckView => {
  if (PRE_RUNTIME_STATUSES.has(input.status)) {
    return check("pending", "snapshot-awaiting-provisioning", input.snapshotAt);
  }
  if (input.status === "archived") {
    return check("not-applicable", "snapshot-historical-archive", input.snapshotAt);
  }
  if (!input.snapshotId) return check("fail", "recovery-head-missing", null);
  if (RUNNING_STATUSES.has(input.status)) {
    return input.snapshotStale
      ? check("fail", "recovery-head-stale", input.snapshotAt)
      : check("pass", "recovery-head-current", input.snapshotAt);
  }
  if (IDLE_SNAPSHOT_STATUSES.has(input.status)) {
    return check("pass", `snapshot-retained-${input.status}`, input.snapshotAt);
  }
  if (input.status === "stopped") {
    return input.terminalCheckpointCount > 0
      ? check("pass", "terminal-checkpoint-present", input.snapshotAt)
      : check("fail", "terminal-checkpoint-missing", input.snapshotAt);
  }
  if (input.status === "failed") {
    return check("not-applicable", "snapshot-last-known-after-failure", input.snapshotAt);
  }
  return check("pending", "snapshot-lifecycle-unknown", input.snapshotAt);
};

export const resolveTickHealthCheck = (input: {
  status: string;
  runtimeExpected: boolean;
  runtimeActive: AdminRuntimeHealthCheckView;
  snapshotCurrent: AdminRuntimeHealthCheckView;
  tickProgress: AdminInstanceTickProgress;
}): AdminRuntimeHealthCheckView => {
  if (!input.runtimeExpected) {
    return check("not-applicable", `tick-not-required-${input.status}`, input.tickProgress.observedAt);
  }
  if (input.runtimeActive.status !== "pass") {
    return check("fail", "tick-runtime-inactive", input.tickProgress.observedAt);
  }
  if (input.snapshotCurrent.status !== "pass") {
    return check("fail", "tick-recovery-head-not-current", input.tickProgress.observedAt);
  }
  return check(input.tickProgress.status, input.tickProgress.reasonCode, input.tickProgress.observedAt);
};

export const resolveCommandHealthCheck = (input: {
  status: string;
  runtimeExpected: boolean;
  runtimeActive: AdminRuntimeHealthCheckView;
  generatedAt: string;
  observationWindowMs: number;
  lastAppliedCommandAt: string | null;
  lastStartedAt: string | null;
}): AdminRuntimeHealthCheckView => {
  if (PRE_RUNTIME_STATUSES.has(input.status)) {
    return check("pending", "commands-awaiting-provisioning", input.lastAppliedCommandAt);
  }
  if (["lobby", "paused", "stopped", "archived"].includes(input.status)) {
    return check("not-applicable", `commands-not-accepted-${input.status}`, input.lastAppliedCommandAt);
  }
  if (input.status === "failed") {
    return check("fail", "commands-server-failed", input.lastAppliedCommandAt);
  }
  if (input.status === "restarting") {
    return check("pending", "commands-restarting", input.lastAppliedCommandAt);
  }
  if (!input.runtimeExpected) {
    return check("pending", "commands-lifecycle-unknown", input.lastAppliedCommandAt);
  }
  if (input.runtimeActive.status !== "pass") {
    return check("fail", "commands-runtime-inactive", input.lastAppliedCommandAt);
  }
  if (!input.lastAppliedCommandAt) return check("pending", "commands-not-yet-observed", null);

  const appliedAt = timestamp(input.lastAppliedCommandAt);
  const startedAt = timestamp(input.lastStartedAt);
  const generatedAt = timestamp(input.generatedAt);
  if (startedAt === null) {
    return check("pending", "commands-start-time-unavailable", input.lastAppliedCommandAt);
  }
  if (appliedAt === null || generatedAt === null || appliedAt > generatedAt) {
    return check("pending", "commands-observation-time-invalid", input.lastAppliedCommandAt);
  }
  if (appliedAt < startedAt) {
    return check("pending", "commands-not-observed-since-start", input.lastAppliedCommandAt);
  }
  if (generatedAt - appliedAt > input.observationWindowMs) {
    return check("pending", "applied-command-observation-stale", input.lastAppliedCommandAt);
  }
  return check("pass", "recent-applied-command-observed", input.lastAppliedCommandAt);
};

const check = (
  status: AdminRuntimeHealthCheckView["status"],
  reasonCode: string,
  observedAt: string | null
): AdminRuntimeHealthCheckView => ({ status, reasonCode, observedAt });

const timestamp = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
