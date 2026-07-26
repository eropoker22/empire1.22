import type { InstanceSnapshotDto } from "../dto";

export const TERMINAL_HOSTED_INSTANCE_STATUSES = [
  "stopped",
  "failed",
  "archived"
] as const;

export const TERMINAL_RUNTIME_INSTANCE_STATUSES = [
  "stopped",
  "ended",
  "destroyed"
] as const;

export const TERMINAL_HOSTED_INSTANCE_STATUS_SQL = TERMINAL_HOSTED_INSTANCE_STATUSES
  .map((status) => `'${status}'`)
  .join(", ");

export const TERMINAL_RUNTIME_INSTANCE_STATUS_SQL = TERMINAL_RUNTIME_INSTANCE_STATUSES
  .map((status) => `'${status}'`)
  .join(", ");

export const isTerminalSnapshot = (
  snapshot: Pick<InstanceSnapshotDto, "metadata" | "state">
): boolean =>
  includesTerminalStatus(snapshot.metadata.status)
  || snapshot.state.root.phase === "resolved";

const includesTerminalStatus = (status: string): boolean =>
  TERMINAL_HOSTED_INSTANCE_STATUSES.includes(
    status as typeof TERMINAL_HOSTED_INSTANCE_STATUSES[number]
  ) || TERMINAL_RUNTIME_INSTANCE_STATUSES.includes(
    status as typeof TERMINAL_RUNTIME_INSTANCE_STATUSES[number]
  );
