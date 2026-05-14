import type { EliminationBalanceConfig } from "../../contracts";

export const DEFAULT_ELIMINATION_SCORE_WEIGHTS: EliminationBalanceConfig["scoreWeights"] = {
  controlledDistricts: 10000,
  districtInfluence: 25,
  activeBuildingCount: 500,
  cleanCash: 0.1,
  dirtyCash: 0.05,
  resources: 0.2,
  population: 2,
  recentActivityBonus: 250
};

export const resolveEliminationConfig = (
  config: { balance: { elimination?: EliminationBalanceConfig } }
): EliminationBalanceConfig | null => config.balance.elimination ?? null;

export const resolveNextEliminationTick = (
  config: EliminationBalanceConfig,
  lastEliminationTick: number | null
): number => (lastEliminationTick === null ? config.firstEliminationTick : lastEliminationTick + config.intervalTicks);
