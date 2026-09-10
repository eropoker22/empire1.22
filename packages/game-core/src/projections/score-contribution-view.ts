import type { GameCoreContext } from "../engine/context";
import { DEFAULT_ELIMINATION_SCORE_WEIGHTS, resolveEliminationConfig } from "../rules/elimination/eliminationConfig";

/** Every row uses score points, so counts and wallet amounts are never compared as percentages. */
export const createScoreContributionView = (raw: Record<string, number>, context: GameCoreContext, final = false): Record<string, number> => {
  const weights = resolveEliminationConfig(context.config)?.scoreWeights ?? DEFAULT_ELIMINATION_SCORE_WEIGHTS;
  const value = (key: string) => Number(raw[key] ?? 0);
  return {
    controlledDistricts: value("controlledDistricts") * weights.controlledDistricts,
    districtInfluence: value("districtInfluence") * weights.districtInfluence,
    activeBuildings: value("activeBuildings") * weights.activeBuildingCount,
    cleanCash: value("cleanCash") * weights.cleanCash,
    dirtyCash: value("dirtyCash") * weights.dirtyCash,
    resources: value("resources") * weights.resources,
    reservedCleanCash: value("reservedCleanCash") * weights.cleanCash,
    buildingCapitalScore: value("buildingCapitalScore"),
    population: value("population") * weights.population,
    recentActivityBonus: value("recentActivityBonus"),
    ...(final ? { downtownBonus: value("downtownBonus"), rareBuildingBonus: value("rareBuildingBonus"), heatPenalty: -value("heatPenalty") } : {})
  };
};
