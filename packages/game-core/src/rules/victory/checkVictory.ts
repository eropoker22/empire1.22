import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import {
  createDistrictControlScores,
  createDurationScores,
  createExistingVictorySummary,
  createVictorySummary
} from "./victoryScoring";
import {
  resolveControlVictoryProgress,
  resolveControlVictoryRules
} from "./victoryControlProgress";
import { resolveEffectiveFinalLockdownTrigger } from "../server-pacing/serverPacingPolicy";

export interface VictoryCheckResult {
  nextState: CoreGameState;
  resolved: boolean;
  summary: VictorySummary;
}

export type VictoryWinnerType = "player" | "alliance" | "none";

export interface VictorySummary {
  hasWinner: boolean;
  winnerType: VictoryWinnerType;
  winnerId: string | null;
  reason: string;
  controlledDistricts: number;
  totalActiveDistricts: number;
  controlPercent: number;
  mode: string;
}

const createOngoingVictoryState = (
  state: CoreGameState,
  context: GameCoreContext,
  progressPayload: Record<string, unknown>
): CoreGameState => {
  const victoryStateId = state.root.victoryStateId ?? `victory:${state.serverInstance.id}`;

  return {
    ...state,
    root: {
      ...state.root,
      victoryStateId,
      version: state.root.victoryStateId === victoryStateId ? state.root.version : state.root.version + 1
    },
    victoryState: {
      id: victoryStateId,
      serverInstanceId: state.serverInstance.id,
      status: "ongoing",
      victoryType: context.config.balance.victoryConditionKey,
      leaderPlayerId: progressPayload.leadingSubjectType === "player" ? String(progressPayload.leadingSubjectId) : null,
      leaderAllianceId: progressPayload.leadingSubjectType === "alliance" ? String(progressPayload.leadingSubjectId) : null,
      progressPayload,
      resolvedAtTick: null,
      version: (state.victoryState?.version ?? 0) + 1
    }
  };
};

/**
 * Responsibility: Checks victory conditions against authoritative state.
 * Belongs here: server-side victory evaluation hooks.
 * Does not belong here: scoreboard rendering or admin transport.
 */
export const checkVictory = (
  state: CoreGameState,
  context: GameCoreContext
): VictoryCheckResult => {
  if (state.victoryState?.status === "resolved" || state.matchResult) {
    return {
      nextState: state,
      resolved: true,
      summary: createExistingVictorySummary(state, context)
    };
  }

  const activeDistricts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  const controlScores = createDistrictControlScores(state, activeDistricts);
  const leader = controlScores[0] ?? null;
  const victoryRules = resolveControlVictoryRules(context, activeDistricts.length);
  const controlProgress = resolveControlVictoryProgress({
    state,
    leader,
    totalActiveDistricts: activeDistricts.length,
    rules: victoryRules
  });
  const finalLockdownEnabled = Boolean(context.config.balance.finalLockdown?.enabled);
  const activeDistrictControlWonByLeader = !finalLockdownEnabled && Boolean(leader && controlProgress.canResolveControlVictoryNow);
  const durationExpired = state.root.tick >= victoryRules.durationTicks;
  const hardTimeoutExpired = state.root.tick >= victoryRules.hardTimeoutTicks;
  const durationFallbackExpired = !finalLockdownEnabled && victoryRules.allowDurationVictoryFallback && durationExpired;
  const timeoutWithoutWinnerExpired = finalLockdownEnabled
    ? !state.finalLockdownState && hardTimeoutExpired
    : !victoryRules.allowDurationVictoryFallback && hardTimeoutExpired;

  if (!activeDistrictControlWonByLeader && !durationFallbackExpired && !timeoutWithoutWinnerExpired) {
    const finalLockdownPayload = finalLockdownEnabled
      ? {
          enabled: true,
          status: state.finalLockdownState?.status ?? "inactive",
          active: state.finalLockdownState?.status === "active" || state.finalLockdownState?.status === "paused",
          pausedByQuietHours: state.finalLockdownState?.pausedByQuietHours ?? false,
          startedAtTick: state.finalLockdownState?.startedAtTick ?? null,
          activeElapsedTicks: state.finalLockdownState?.activeElapsedTicks ?? 0,
          activeDurationTicks: state.finalLockdownState?.activeDurationTicks ?? context.config.balance.finalLockdown?.activeDurationTicks ?? 0,
          remainingActiveTicks: state.finalLockdownState?.remainingActiveTicks ?? context.config.balance.finalLockdown?.activeDurationTicks ?? 0,
          triggerActivePlayers: resolveEffectiveFinalLockdownTrigger(state, context.config),
          topRankCount: context.config.balance.finalLockdown?.topRankCount ?? 3
        }
      : null;
    const summary = createVictorySummary({
      mode: context.config.mode,
      reason: finalLockdownEnabled
        ? state.finalLockdownState
          ? `final_lockdown_${state.finalLockdownState.status}`
          : "final_lockdown_waiting_for_top8"
        : controlProgress.reason,
      winner: leader,
      totalActiveDistricts: activeDistricts.length
    });
    const payloadControlProgress = finalLockdownEnabled
      ? {
          ...controlProgress,
          controlProgressReason: controlProgress.reason,
          reason: summary.reason
        }
      : controlProgress;

    return {
      nextState: createOngoingVictoryState(state, context, {
        ...summary,
        ...payloadControlProgress,
        controlledDistrictCount: summary.controlledDistricts,
        totalActiveDistrictCount: activeDistricts.length,
        controlVictoryThreshold: victoryRules.threshold,
        durationTicks: victoryRules.durationTicks,
        hardTimeoutTicks: victoryRules.hardTimeoutTicks,
        allowDurationVictoryFallback: victoryRules.allowDurationVictoryFallback,
        finalLockdown: finalLockdownPayload
      }),
      resolved: false,
      summary
    };
  }

  const durationScores = createDurationScores(state, activeDistricts);
  const winner = activeDistrictControlWonByLeader
    ? leader
    : durationFallbackExpired
      ? durationScores[0] ?? null
      : null;
  const reason = activeDistrictControlWonByLeader
    ? `control:${context.config.balance.victoryConditionKey}`
    : timeoutWithoutWinnerExpired
      ? "timeout_no_winner"
      : activeDistricts.length === 0
        ? "duration:no-active-districts"
        : `duration:${context.config.balance.victoryConditionKey}`;
  const summary = createVictorySummary({
    mode: context.config.mode,
    reason,
    winner,
    totalActiveDistricts: activeDistricts.length
  });
  const winnerPlayerId = summary.winnerType === "player" ? summary.winnerId : null;
  const winnerAllianceId = summary.winnerType === "alliance" ? summary.winnerId : null;
  const victoryStateId = state.root.victoryStateId ?? `victory:${state.serverInstance.id}`;
  const matchResultId = state.root.matchResultId ?? `match:${state.serverInstance.id}:${state.root.tick}`;
  const endedAt = new Date(0).toISOString();

  return {
    nextState: {
      ...state,
      serverInstance: {
        ...state.serverInstance,
        status: "ended",
        endedAt,
        version: state.serverInstance.version + 1
      },
      root: {
        ...state.root,
        phase: PRODUCTION_GAME_LIFECYCLE_PHASES.resolved,
        victoryStateId,
        matchResultId,
        version: state.root.version + 1
      },
      victoryState: {
        id: victoryStateId,
        serverInstanceId: state.serverInstance.id,
        status: "resolved",
        victoryType: context.config.balance.victoryConditionKey,
        leaderPlayerId: winnerPlayerId,
        leaderAllianceId: winnerAllianceId,
        progressPayload: {
          ...summary,
          ...controlProgress,
          reason,
          controlledDistrictCount: summary.controlledDistricts,
          totalActiveDistrictCount: activeDistricts.length,
          controlVictoryThreshold: victoryRules.threshold,
          durationTicks: victoryRules.durationTicks,
          hardTimeoutTicks: victoryRules.hardTimeoutTicks,
          allowDurationVictoryFallback: victoryRules.allowDurationVictoryFallback
        },
        resolvedAtTick: state.root.tick,
        version: (state.victoryState?.version ?? 0) + 1
      },
      matchResult: {
        id: matchResultId,
        serverInstanceId: state.serverInstance.id,
        endedAt,
        winnerPlayerId,
        winnerAllianceId,
        ranking: (durationFallbackExpired || timeoutWithoutWinnerExpired ? durationScores : controlScores).map((score, index) => ({
          subjectType: score.subjectType,
          subjectId: score.subjectId,
          rank: index + 1,
          score: score.score
        })),
        reason
      }
    },
    resolved: true,
    summary
  };
};
