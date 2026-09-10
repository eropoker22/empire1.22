import type { ConvenienceStoreBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { applyFactionPopulationGeneration, getFactionPassiveModifiers } from "../rules/factions/factionRules";

export const getOwnedConvenienceStoreCount = (
  state: CoreGameState,
  playerId: string,
  config: ConvenienceStoreBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;
export const resolveConvenienceStorePopulationPerMinute = (
  state: CoreGameState,
  playerId: string,
  config: ConvenienceStoreBalanceConfig,
  context?: GameCoreContext
): number => {
  const extraStores = Math.max(0, getOwnedConvenienceStoreCount(state, playerId, config) - 1);
  const baseRate = Math.max(0, Number(config.populationPerMinute || 0))
    + extraStores * Math.max(0, Number(config.network.populationPerMinuteBonusPerExtraStore || 0));
  return context
    ? applyFactionPopulationGeneration(baseRate, getFactionPassiveModifiers(state, playerId, context))
    : baseRate;
};
