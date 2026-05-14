import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import type { VictoryScore } from "./victoryScoring";

export type ControlVictoryPendingReason =
  | "minimum_server_age_not_reached"
  | "control_hold_not_completed"
  | "below_control_threshold"
  | "control_victory_ready";

export interface ControlVictoryRules {
  threshold: number;
  requiredControlledDistricts: number;
  minimumVictoryTicks: number;
  controlHoldRequiredTicks: number;
  durationTicks: number;
  hardTimeoutTicks: number;
  allowDurationVictoryFallback: boolean;
}

export interface ControlVictoryProgress {
  requiredControlledDistricts: number;
  minimumVictoryTicks: number;
  currentTick: number;
  controlHoldStartedAtTick: number | null;
  controlHoldRequiredTicks: number;
  controlHoldRemainingTicks: number;
  leadingSubjectType: VictoryScore["subjectType"] | null;
  leadingSubjectId: string | null;
  leadingControlPercent: number;
  canResolveControlVictoryNow: boolean;
  reason: ControlVictoryPendingReason;
}

export const resolveControlVictoryRules = (
  context: GameCoreContext,
  totalActiveDistricts: number
): ControlVictoryRules => {
  const threshold = Math.min(1, Math.max(0.01, Number(context.config.balance.districtControlVictoryThreshold ?? 1)));
  const durationTicks = Math.max(1, Math.ceil(context.config.technical.gameDurationMs / Math.max(1, context.config.tickRateMs)));
  const configuredHardTimeoutTicks = Number(context.config.balance.hardTimeoutTicks);

  return {
    threshold,
    requiredControlledDistricts: Math.max(1, Math.ceil(Math.max(0, totalActiveDistricts) * threshold)),
    minimumVictoryTicks: Math.max(0, Math.floor(Number(context.config.balance.minimumVictoryTicks ?? 0))),
    controlHoldRequiredTicks: Math.max(0, Math.floor(Number(context.config.balance.districtControlHoldTicks ?? 0))),
    durationTicks,
    hardTimeoutTicks: Number.isFinite(configuredHardTimeoutTicks) && configuredHardTimeoutTicks > 0
      ? Math.floor(configuredHardTimeoutTicks)
      : durationTicks,
    allowDurationVictoryFallback: context.config.balance.allowDurationVictoryFallback ?? true
  };
};

export const resolveControlVictoryProgress = (input: {
  state: CoreGameState;
  leader: VictoryScore | null;
  totalActiveDistricts: number;
  rules: ControlVictoryRules;
}): ControlVictoryProgress => {
  const currentTick = Math.max(0, Math.floor(Number(input.state.root.tick || 0)));
  const leadingControlPercent = input.leader && input.totalActiveDistricts > 0
    ? Math.round((input.leader.controlledDistricts / input.totalActiveDistricts) * 10000) / 100
    : 0;
  const leaderAtThreshold = Boolean(
    input.totalActiveDistricts > 1
    && input.leader
    && input.leader.controlledDistricts >= input.rules.requiredControlledDistricts
  );
  const previousPayload = input.state.victoryState?.progressPayload ?? {};
  const previousHoldStartedAtTick = Number(previousPayload.controlHoldStartedAtTick);
  const previousLeaderMatches = input.leader
    && previousPayload.leadingSubjectType === input.leader.subjectType
    && previousPayload.leadingSubjectId === input.leader.subjectId;
  const controlHoldStartedAtTick = leaderAtThreshold
    ? previousLeaderMatches && Number.isFinite(previousHoldStartedAtTick) && previousHoldStartedAtTick >= 0
      ? Math.min(previousHoldStartedAtTick, currentTick)
      : currentTick
    : null;
  const controlHoldElapsedTicks = controlHoldStartedAtTick === null
    ? 0
    : Math.max(0, currentTick - controlHoldStartedAtTick);
  const controlHoldRemainingTicks = leaderAtThreshold
    ? Math.max(0, input.rules.controlHoldRequiredTicks - controlHoldElapsedTicks)
    : input.rules.controlHoldRequiredTicks;
  const minimumServerAgeReached = currentTick >= input.rules.minimumVictoryTicks;
  const controlHoldCompleted = leaderAtThreshold && controlHoldRemainingTicks <= 0;
  const canResolveControlVictoryNow = leaderAtThreshold && minimumServerAgeReached && controlHoldCompleted;

  return {
    requiredControlledDistricts: input.rules.requiredControlledDistricts,
    minimumVictoryTicks: input.rules.minimumVictoryTicks,
    currentTick,
    controlHoldStartedAtTick,
    controlHoldRequiredTicks: input.rules.controlHoldRequiredTicks,
    controlHoldRemainingTicks,
    leadingSubjectType: input.leader?.subjectType ?? null,
    leadingSubjectId: input.leader?.subjectId ?? null,
    leadingControlPercent,
    canResolveControlVictoryNow,
    reason: canResolveControlVictoryNow
      ? "control_victory_ready"
      : !leaderAtThreshold
        ? "below_control_threshold"
        : !minimumServerAgeReached
          ? "minimum_server_age_not_reached"
          : "control_hold_not_completed"
  };
};
