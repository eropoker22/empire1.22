import type { PlayerId } from "@empire/shared-types";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { DEFAULT_ELIMINATION_SCORE_WEIGHTS, resolveEliminationConfig } from "./eliminationConfig";

export interface PlayerEliminationScore {
  playerId: PlayerId;
  playerName: string;
  score: number;
  controlledDistricts: number;
  totalOwnedDistrictInfluence: number;
  activeBuildingCount: number;
  cleanCash: number;
  dirtyCash: number;
  totalResourceValue: number;
  population: number;
  recentActivityBonus: number;
  lastActionAt: string | null;
}

export const createPlayerEliminationScore = (
  state: CoreGameState,
  playerId: PlayerId,
  context: GameCoreContext
): PlayerEliminationScore => {
  const player = state.playersById[playerId];
  const weights = resolveEliminationConfig(context.config)?.scoreWeights ?? DEFAULT_ELIMINATION_SCORE_WEIGHTS;
  const districts = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed");
  const resourceBalances = state.resourceStatesById[player?.resourceStateId ?? ""]?.balances ?? {};
  const cleanCash = positiveNumber(resourceBalances.cash);
  const dirtyCash = positiveNumber(resourceBalances["dirty-cash"]);
  const population = positiveNumber(player?.population ?? resourceBalances.population);
  const totalResourceValue = Object.entries(resourceBalances)
    .filter(([key]) => key !== "cash" && key !== "dirty-cash" && key !== "population")
    .reduce((sum, [, value]) => sum + positiveNumber(value), 0);
  const activeBuildingCount = Object.values(state.buildingsById)
    .filter((building) => building.ownerPlayerId === playerId && building.status === "active").length;
  const totalOwnedDistrictInfluence = districts.reduce((sum, district) => sum + positiveNumber(district.influence), 0);
  const recentActivityBonus = player?.lastActionAt ? weights.recentActivityBonus : 0;
  const score =
    districts.length * weights.controlledDistricts
    + totalOwnedDistrictInfluence * weights.districtInfluence
    + activeBuildingCount * weights.activeBuildingCount
    + cleanCash * weights.cleanCash
    + dirtyCash * weights.dirtyCash
    + totalResourceValue * weights.resources
    + population * weights.population
    + recentActivityBonus;

  return {
    playerId,
    playerName: player?.name ?? playerId,
    score,
    controlledDistricts: districts.length,
    totalOwnedDistrictInfluence,
    activeBuildingCount,
    cleanCash,
    dirtyCash,
    totalResourceValue,
    population,
    recentActivityBonus,
    lastActionAt: player?.lastActionAt ?? null
  };
};

export const compareEliminationScores = (left: PlayerEliminationScore, right: PlayerEliminationScore): number =>
  left.controlledDistricts - right.controlledDistricts
  || left.score - right.score
  || compareLastActionAt(left.lastActionAt, right.lastActionAt)
  || left.playerId.localeCompare(right.playerId);

const compareLastActionAt = (left: string | null, right: string | null): number => {
  const leftTime = Date.parse(left ?? "");
  const rightTime = Date.parse(right ?? "");
  const safeLeft = Number.isFinite(leftTime) ? leftTime : -Infinity;
  const safeRight = Number.isFinite(rightTime) ? rightTime : -Infinity;
  return safeLeft - safeRight;
};

const positiveNumber = (value: unknown): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};
