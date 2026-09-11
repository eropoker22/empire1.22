import type { Building } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { getFactionPassiveModifiers, resolveFactionProductionMultiplier } from "../factions/factionRules";
import { resolveDistrictStabilizationProductionSpeed } from "./productionRules";

export const productionOwnerId = (state: CoreGameState, building: Building): string =>
  building.ownerPlayerId === "player:neutral" ? state.districtsById[building.districtId]?.ownerPlayerId ?? building.ownerPlayerId : building.ownerPlayerId;

export const resolveProductionNetworkMultiplier = (state: CoreGameState, building: Building, context: GameCoreContext): number => {
  const config = building.buildingTypeId === "factory" ? context.config.balance.factory
    : building.buildingTypeId === "armory" ? context.config.balance.armory : undefined;
  if (!config) return 1;
  const owner = productionOwnerId(state, building);
  const count = Object.values(state.buildingsById).filter(b => b.status === "active" && b.buildingTypeId === building.buildingTypeId
    && (building.buildingTypeId === "factory" ? productionOwnerId(state, b) : b.ownerPlayerId) === owner).length;
  const band = Math.min(4, Math.max(1, count)) as 1 | 2 | 3 | 4;
  return Math.min(config.network.maxSpeedMultiplier, config.network.speedMultipliers[band]);
};

export const resolveProductionTransitionFactors = (state: CoreGameState, building: Building, recipeId: string, context: GameCoreContext): number => {
  const config = building.buildingTypeId === "factory" ? context.config.balance.factory
    : building.buildingTypeId === "armory" ? context.config.balance.armory
    : building.buildingTypeId === "pharmacy" ? context.config.balance.pharmacy
    : building.buildingTypeId === "drug_lab" ? context.config.balance.drugLab : undefined;
  const recipe = config ? Object.values(config.recipes).find(r => r.recipeId === recipeId || r.outputResourceKey === recipeId) : undefined;
  return resolveDistrictStabilizationProductionSpeed(state, building, context)
    * resolveProductionNetworkMultiplier(state, building, context)
    * resolveFactionProductionMultiplier(recipe?.outputResourceKey ?? recipeId, building.buildingTypeId,
      getFactionPassiveModifiers(state, productionOwnerId(state, building), context));
};
