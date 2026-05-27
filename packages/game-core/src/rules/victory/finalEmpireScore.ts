import type { PlayerFactionId, PlayerId } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { createPlayerEliminationScore } from "../elimination/eliminationScore";

export interface PlayerFinalEmpireScore {
  playerId: PlayerId;
  playerName: string;
  factionId: PlayerFactionId;
  score: number;
  baseScore: number;
  controlledDistricts: number;
  downtownDistricts: number;
  rareBuildings: number;
  activeBuildings: number;
  heat: number;
  heatPenalty: number;
  scoreBreakdown: Record<string, number>;
}

const RARE_BUILDING_TYPES = new Set([
  "stock_exchange",
  "central_bank",
  "airport",
  "city_hall",
  "courthouse",
  "court",
  "vip_lounge",
  "port",
  "parliament"
]);

export const createPlayerFinalEmpireScore = (
  state: CoreGameState,
  playerId: PlayerId,
  context: GameCoreContext
): PlayerFinalEmpireScore => {
  const player = state.playersById[playerId];
  const finalConfig = context.config.balance.finalLockdown;
  const base = createPlayerEliminationScore(state, playerId, context);
  const ownedDistricts = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed");
  const downtownDistricts = ownedDistricts.filter((district) => isDowntownDistrict(district.zone)).length;
  const activeOwnedBuildings = Object.values(state.buildingsById)
    .filter((building) => building.ownerPlayerId === playerId && building.status === "active");
  const rareBuildings = activeOwnedBuildings.filter((building) => RARE_BUILDING_TYPES.has(building.buildingTypeId)).length;
  const policeState = player?.policeStateId ? state.policeStatesById[player.policeStateId] : null;
  const heat = Math.max(0, Number(policeState?.heat ?? 0));
  const downtownBonus = downtownDistricts * Math.max(0, Number(finalConfig?.downtownDistrictBonus ?? 15_000));
  const rareBuildingBonus = rareBuildings * Math.max(0, Number(finalConfig?.rareBuildingBonus ?? 5_000));
  const heatPenalty = calculateHeatPenalty(heat, context);
  const score = Math.max(0, base.score + downtownBonus + rareBuildingBonus - heatPenalty);

  return {
    playerId,
    playerName: player?.name ?? playerId,
    factionId: player?.factionId ?? "mafian",
    score,
    baseScore: base.score,
    controlledDistricts: base.controlledDistricts,
    downtownDistricts,
    rareBuildings,
    activeBuildings: base.activeBuildingCount,
    heat,
    heatPenalty,
    scoreBreakdown: {
      baseScore: roundScore(base.score),
      controlledDistricts: base.controlledDistricts,
      districtInfluence: roundScore(base.totalOwnedDistrictInfluence),
      activeBuildings: base.activeBuildingCount,
      cleanCash: roundScore(base.cleanCash),
      dirtyCash: roundScore(base.dirtyCash),
      resources: roundScore(base.totalResourceValue),
      population: roundScore(base.population),
      recentActivityBonus: roundScore(base.recentActivityBonus),
      downtownDistricts,
      downtownBonus: roundScore(downtownBonus),
      rareBuildings,
      rareBuildingBonus: roundScore(rareBuildingBonus),
      heat,
      heatPenalty: roundScore(heatPenalty),
      finalScore: roundScore(score)
    }
  };
};

export const createFinalEmpireRanking = (
  state: CoreGameState,
  context: GameCoreContext
): PlayerFinalEmpireScore[] =>
  state.root.playerIds
    .filter((playerId) => state.playersById[playerId]?.status === "active")
    .map((playerId) => createPlayerFinalEmpireScore(state, playerId, context))
    .sort(compareFinalEmpireScores);

export const compareFinalEmpireScores = (
  left: PlayerFinalEmpireScore,
  right: PlayerFinalEmpireScore
): number =>
  right.score - left.score
  || right.downtownDistricts - left.downtownDistricts
  || right.controlledDistricts - left.controlledDistricts
  || left.heat - right.heat
  || left.playerId.localeCompare(right.playerId);

const calculateHeatPenalty = (heat: number, context: GameCoreContext): number => {
  const config = context.config.balance.finalLockdown;
  const penaltyStart = Math.max(0, Number(config?.heatPenaltyStart ?? 120));
  const penaltyPerPoint = Math.max(0, Number(config?.heatPenaltyPerPoint ?? 50));
  const extremeStart = Math.max(0, Number(config?.extremeHeatPenaltyStart ?? 180));
  const extremePenaltyPerPoint = Math.max(0, Number(config?.extremeHeatPenaltyPerPoint ?? 100));
  const basePenalty = Math.max(0, heat - penaltyStart) * penaltyPerPoint;
  const extremePenalty = Math.max(0, heat - extremeStart) * extremePenaltyPerPoint;
  return basePenalty + extremePenalty;
};

const isDowntownDistrict = (zone: string | null | undefined): boolean =>
  String(zone ?? "").toLowerCase() === "downtown";

const roundScore = (value: number): number =>
  Math.round(value * 100) / 100;
