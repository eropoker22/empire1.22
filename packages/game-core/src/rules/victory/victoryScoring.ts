import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import type { VictorySummary } from "./checkVictory";

export interface VictoryScore {
  subjectType: "player" | "alliance";
  subjectId: string;
  controlledDistricts: number;
  influence: number;
  score: number;
}

export const createDistrictControlScores = (
  state: CoreGameState,
  districts: Array<CoreGameState["districtsById"][string]>
): VictoryScore[] => {
  const scoresByKey = new Map<string, VictoryScore>();

  for (const district of districts) {
    const ownerPlayer = district.ownerPlayerId ? state.playersById[district.ownerPlayerId] : null;
    const activeOwnerPlayer = ownerPlayer?.status === "active" ? ownerPlayer : null;

    if (district.ownerPlayerId && activeOwnerPlayer) {
      addDistrictScore(scoresByKey, {
        subjectType: "player",
        subjectId: district.ownerPlayerId,
        influence: district.influence
      });
    }

    const allianceId = activeOwnerPlayer
      ? district.controllerAllianceId ?? activeOwnerPlayer.allianceId
      : null;

    if (allianceId) {
      addDistrictScore(scoresByKey, {
        subjectType: "alliance",
        subjectId: allianceId,
        influence: district.influence
      });
    }
  }

  return [...scoresByKey.values()].sort(compareVictoryScores);
};

export const createDurationScores = (
  state: CoreGameState,
  districts: Array<CoreGameState["districtsById"][string]>
): VictoryScore[] =>
  createDistrictControlScores(state, districts)
    .map((score) => ({
      ...score,
      score: score.controlledDistricts * 100
        + score.influence
        + (score.subjectType === "alliance"
          ? Math.max(0, state.alliancesById[score.subjectId]?.memberIds.length ?? 0) * 5
          : 0)
    }))
    .sort(compareVictoryScores);

export const createVictorySummary = (input: {
  mode: string;
  reason: string;
  winner: VictoryScore | null;
  totalActiveDistricts: number;
}): VictorySummary => {
  const controlledDistricts = input.winner?.controlledDistricts ?? 0;
  const hasWinner = Boolean(input.winner && controlledDistricts > 0);

  return {
    hasWinner,
    winnerType: hasWinner ? input.winner!.subjectType : "none",
    winnerId: hasWinner ? input.winner!.subjectId : null,
    reason: input.reason,
    controlledDistricts,
    totalActiveDistricts: input.totalActiveDistricts,
    controlPercent: input.totalActiveDistricts > 0
      ? Math.round((controlledDistricts / input.totalActiveDistricts) * 10000) / 100
      : 0,
    mode: input.mode
  };
};

export const createExistingVictorySummary = (
  state: CoreGameState,
  context: GameCoreContext
): VictorySummary => {
  const payload = state.victoryState?.progressPayload ?? {};
  const winnerType = state.matchResult?.winnerAllianceId
    ? "alliance"
    : state.matchResult?.winnerPlayerId
      ? "player"
      : "none";

  return {
    hasWinner: winnerType !== "none",
    winnerType,
    winnerId: state.matchResult?.winnerAllianceId ?? state.matchResult?.winnerPlayerId ?? null,
    reason: String(payload.reason ?? state.matchResult?.reason ?? "resolved"),
    controlledDistricts: Number(payload.controlledDistricts ?? payload.controlledDistrictCount ?? 0),
    totalActiveDistricts: Number(payload.totalActiveDistricts ?? payload.totalActiveDistrictCount ?? 0),
    controlPercent: Number(payload.controlPercent ?? 0),
    mode: String(payload.mode ?? context.config.mode)
  };
};

const addDistrictScore = (
  scoresByKey: Map<string, VictoryScore>,
  input: { subjectType: "player" | "alliance"; subjectId: string; influence: number }
) => {
  const key = `${input.subjectType}:${input.subjectId}`;
  const existing = scoresByKey.get(key);

  scoresByKey.set(key, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    controlledDistricts: (existing?.controlledDistricts ?? 0) + 1,
    influence: (existing?.influence ?? 0) + Math.max(0, Number(input.influence || 0)),
    score: (existing?.controlledDistricts ?? 0) + 1
  });
};

const compareVictoryScores = (left: VictoryScore, right: VictoryScore): number =>
  right.score - left.score
  || right.controlledDistricts - left.controlledDistricts
  || getVictorySubjectTypeOrder(left) - getVictorySubjectTypeOrder(right)
  || left.subjectId.localeCompare(right.subjectId);

const getVictorySubjectTypeOrder = (score: VictoryScore): number =>
  score.subjectType === "alliance" ? 0 : 1;
