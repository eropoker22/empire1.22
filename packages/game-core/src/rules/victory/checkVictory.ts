import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { PRODUCTION_GAME_LIFECYCLE_PHASES } from "@empire/shared-types";
import {
  createDistrictControlScores,
  createDurationScores,
  createExistingVictorySummary,
  createVictorySummary
} from "./victoryScoring";

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
  const controlVictoryThreshold = Math.min(1, Math.max(0.01, context.config.balance.districtControlVictoryThreshold ?? 1));
  const requiredControlledDistricts = Math.max(1, Math.ceil(activeDistricts.length * controlVictoryThreshold));
  const activeDistrictControlWonByLeader =
    context.config.mode === "free" &&
    activeDistricts.length > 1 &&
    leader !== null &&
    leader.controlledDistricts >= requiredControlledDistricts;
  const durationTicks = Math.max(1, Math.ceil(context.config.technical.gameDurationMs / Math.max(1, context.config.tickRateMs)));
  const durationExpired = state.root.tick >= durationTicks;

  if (!activeDistrictControlWonByLeader && !durationExpired) {
    return {
      nextState: state,
      resolved: false,
      summary: createVictorySummary({
        mode: context.config.mode,
        reason: "ongoing",
        winner: leader,
        totalActiveDistricts: activeDistricts.length
      })
    };
  }

  const durationScores = createDurationScores(state, activeDistricts);
  const winner = activeDistrictControlWonByLeader
    ? leader
    : durationScores[0] ?? null;
  const reason = activeDistrictControlWonByLeader
    ? `control:${context.config.balance.victoryConditionKey}`
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
          reason,
          controlledDistrictCount: summary.controlledDistricts,
          totalActiveDistrictCount: activeDistricts.length,
          requiredControlledDistricts,
          durationTicks,
          currentTick: state.root.tick
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
        ranking: (durationExpired ? durationScores : controlScores).map((score, index) => ({
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
