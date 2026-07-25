import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "./instance-snapshot-dto";

export const SNAPSHOT_CHECKPOINT_KINDS = {
  periodic: "periodic-checkpoint",
  lifecycle: "lifecycle-checkpoint",
  terminal: "terminal-checkpoint",
  manual: "manual-checkpoint",
  legacy: "legacy-checkpoint"
} as const;

export type SnapshotCheckpointKind =
  typeof SNAPSHOT_CHECKPOINT_KINDS[keyof typeof SNAPSHOT_CHECKPOINT_KINDS];

export interface SnapshotCheckpointRecord {
  checkpointId: string;
  instanceId: ServerInstanceId;
  kind: SnapshotCheckpointKind;
  reasonCode: string;
  lifecyclePhase: string | null;
  protected: boolean;
  createdAt: string;
  tick: number;
  rootVersion: number;
  snapshot: InstanceSnapshotDto;
}

export interface CreateSnapshotCheckpointOptions {
  kind: SnapshotCheckpointKind;
  reasonCode: string;
  lifecyclePhase?: string | null;
  protected?: boolean;
}

export const createSnapshotCheckpoint = (
  snapshot: InstanceSnapshotDto,
  options: CreateSnapshotCheckpointOptions
): SnapshotCheckpointRecord => {
  const reasonCode = normalizeReasonCode(options.reasonCode);
  const lifecyclePhase = normalizeOptionalText(options.lifecyclePhase);
  return {
    checkpointId: [
      "checkpoint",
      snapshot.instanceId,
      snapshot.tick,
      snapshot.integrity.rootVersion,
      options.kind,
      reasonCode
    ].join(":"),
    instanceId: snapshot.instanceId,
    kind: options.kind,
    reasonCode,
    lifecyclePhase,
    protected: options.protected === true,
    createdAt: snapshot.createdAt,
    tick: snapshot.tick,
    rootVersion: snapshot.integrity.rootVersion,
    snapshot
  };
};

const normalizeReasonCode = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").slice(0, 80);
  if (!normalized) throw new Error("Snapshot checkpoint requires a reason code.");
  return normalized;
};

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, 80) : null;
};
