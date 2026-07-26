import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import {
  SNAPSHOT_CHECKPOINT_KINDS,
  createSnapshotCheckpoint,
  type InstanceSnapshotDto,
  type SnapshotCheckpointRecord
} from "../dto";

export const createDueAuthoritativeCheckpoint = (input: {
  snapshot: InstanceSnapshotDto;
  previousPhase: string;
  snapshotIntervalTicks: number;
  includePeriodic?: boolean;
}): SnapshotCheckpointRecord | null => {
  const { snapshot, previousPhase } = input;
  const nextPhase = snapshot.state.root.phase;
  if (previousPhase !== nextPhase) {
    if (nextPhase === PRODUCTION_GAME_LIFECYCLE_PHASES.resolved) {
      return createSnapshotCheckpoint(snapshot, {
        kind: SNAPSHOT_CHECKPOINT_KINDS.terminal,
        reasonCode: "instance-completed",
        lifecyclePhase: nextPhase,
        protected: true
      });
    }
    return createSnapshotCheckpoint(snapshot, {
      kind: SNAPSHOT_CHECKPOINT_KINDS.lifecycle,
      reasonCode: lifecycleTransitionReason(previousPhase, nextPhase),
      lifecyclePhase: nextPhase,
      protected: nextPhase === PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown
    });
  }
  if (input.includePeriodic === false) return null;
  const interval = normalizeSnapshotInterval(input.snapshotIntervalTicks);
  if (snapshot.tick <= 0 || snapshot.tick % interval !== 0) return null;
  return createSnapshotCheckpoint(snapshot, {
    kind: SNAPSHOT_CHECKPOINT_KINDS.periodic,
    reasonCode: "periodic-cadence",
    lifecyclePhase: nextPhase
  });
};

export const createLifecycleCheckpoint = (
  snapshot: InstanceSnapshotDto,
  reasonCode: string,
  options: { terminal?: boolean; protected?: boolean } = {}
): SnapshotCheckpointRecord => createSnapshotCheckpoint(snapshot, {
  kind: options.terminal
    ? SNAPSHOT_CHECKPOINT_KINDS.terminal
    : SNAPSHOT_CHECKPOINT_KINDS.lifecycle,
  reasonCode,
  lifecyclePhase: snapshot.state.root.phase,
  protected: options.protected === true || options.terminal === true
});

const normalizeSnapshotInterval = (value: number): number =>
  Number.isSafeInteger(value) && value > 0 ? value : 1;

const lifecycleTransitionReason = (previousPhase: string, nextPhase: string): string => {
  if (
    previousPhase === PRODUCTION_GAME_LIFECYCLE_PHASES.bootstrapping &&
    nextPhase === PRODUCTION_GAME_LIFECYCLE_PHASES.live
  ) {
    return "instance-started";
  }
  if (nextPhase === PRODUCTION_GAME_LIFECYCLE_PHASES.finalLockdown) {
    return "final-lockdown-entered";
  }
  return `phase-${previousPhase}-to-${nextPhase}`;
};
