export type AdminRuntimeHealthCheckStatus =
  | "pass"
  | "fail"
  | "pending"
  | "not-applicable";

export interface AdminRuntimeHealthCheckView {
  status: AdminRuntimeHealthCheckStatus;
  reasonCode: string;
  observedAt: string | null;
}

export interface AdminInstanceRuntimeHealthView {
  lifecycleStatus: string;
  expectedTickRateMs: number | null;
  freshnessThresholdMs: number | null;
  commandObservationWindowMs: number | null;
  instanceLastTick: number | null;
  instanceLastErrorCode: string | null;
  lastAppliedCommandAt: string | null;
  runtimeActive: AdminRuntimeHealthCheckView;
  tickAdvancing: AdminRuntimeHealthCheckView;
  snapshotCurrent: AdminRuntimeHealthCheckView;
  commandsAccepted: AdminRuntimeHealthCheckView;
}
