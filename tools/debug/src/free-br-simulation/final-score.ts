import {
  createEliminationScore,
  getOwnedDistricts,
  isRareBuildingType
} from "./state-helpers";
import type { FreeBrPlayer, FreeBrSimulationState } from "./types";

export const assignPlacements = (state: FreeBrSimulationState): void => {
  const activeRanked = state.players
    .filter((player) => player.status === "active")
    .sort((left, right) => compareFinalScores(createFinalEmpireScore(state, left), createFinalEmpireScore(state, right)));
  for (const [index, player] of activeRanked.entries()) {
    state.stats[player.id].finalPlacement = index + 1;
  }
};

export const createFinalEmpireScore = (state: FreeBrSimulationState, player: FreeBrPlayer) => {
  const base = createEliminationScore(state, player);
  const finalConfig = state.config.balance.finalLockdown;
  const owned = getOwnedDistricts(state, player.id);
  const downtownDistricts = owned.filter((district) => district.isDowntown).length;
  const rareBuildings = owned.filter((district) => isRareBuildingType(district.buildingType)).length;
  const downtownBonus = downtownDistricts * Math.max(0, Number(finalConfig?.downtownDistrictBonus ?? 15_000));
  const rareBuildingBonus = rareBuildings * Math.max(0, Number(finalConfig?.rareBuildingBonus ?? 5_000));
  const heat = Math.max(0, player.heat);
  const heatPenaltyStart = Math.max(0, Number(finalConfig?.heatPenaltyStart ?? 120));
  const heatPenaltyPerPoint = Math.max(0, Number(finalConfig?.heatPenaltyPerPoint ?? 50));
  const extremeStart = Math.max(0, Number(finalConfig?.extremeHeatPenaltyStart ?? 180));
  const extremePenaltyPerPoint = Math.max(0, Number(finalConfig?.extremeHeatPenaltyPerPoint ?? 100));
  const heatPenalty = Math.max(0, heat - heatPenaltyStart) * heatPenaltyPerPoint
    + Math.max(0, heat - extremeStart) * extremePenaltyPerPoint;
  const score = Math.max(0, base.score + downtownBonus + rareBuildingBonus - heatPenalty);

  return {
    playerId: player.id,
    playerName: player.name,
    factionId: player.factionId,
    strategyId: player.strategyId,
    score,
    controlledDistricts: base.controlledDistricts,
    downtownDistricts,
    rareBuildings,
    activeBuildings: base.activeBuildingCount,
    heat,
    scoreBreakdown: {
      baseScore: roundScore(base.score),
      downtownDistricts,
      downtownBonus: roundScore(downtownBonus),
      rareBuildings,
      rareBuildingBonus: roundScore(rareBuildingBonus),
      heat: roundScore(heat),
      heatPenalty: roundScore(heatPenalty),
      finalScore: roundScore(score)
    }
  };
};

export const createFinalEmpireRanking = (state: FreeBrSimulationState) =>
  state.players
    .filter((player) => player.status === "active")
    .map((player) => ({ player, score: createFinalEmpireScore(state, player) }))
    .sort((left, right) => compareFinalScores(left.score, right.score));

export const findLeader = (state: FreeBrSimulationState): FreeBrPlayer | null =>
  state.players
    .filter((player) => player.status === "active")
    .sort((left, right) => compareFinalScores(createFinalEmpireScore(state, left), createFinalEmpireScore(state, right)))[0] ?? null;

export const resolveActivePlacement = (state: FreeBrSimulationState, player: FreeBrPlayer): number => {
  const activeRanked = state.players
    .filter((candidate) => candidate.status === "active")
    .sort((left, right) => compareFinalScores(createFinalEmpireScore(state, left), createFinalEmpireScore(state, right)));
  const index = activeRanked.findIndex((candidate) => candidate.id === player.id);
  return index >= 0 ? index + 1 : state.stats[player.id].finalPlacement ?? state.players.length;
};

const compareFinalScores = (
  left: ReturnType<typeof createFinalEmpireScore>,
  right: ReturnType<typeof createFinalEmpireScore>
): number =>
  (right.score - left.score)
  || (right.downtownDistricts - left.downtownDistricts)
  || (right.controlledDistricts - left.controlledDistricts)
  || (left.heat - right.heat)
  || left.playerId.localeCompare(right.playerId);

const roundScore = (value: number): number =>
  Math.round(value * 100) / 100;
