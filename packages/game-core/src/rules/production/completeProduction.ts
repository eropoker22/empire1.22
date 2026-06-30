import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { composeEntityId } from "../../utils";
import { resolvePowerStationInfrastructureMultiplier } from "../../handlers/powerStationBuildingActions";
import { applyDayNightProductionMultiplier } from "../day-night/dayNight";
import {
  getFactionPassiveModifiers,
  resolveFactionProductionMultiplier
} from "../factions/factionRules";
import { resolveProductionBuildingLevelMultiplier } from "../buildings/buildingUpgradeRules";

/**
 * Responsibility: Resolves completed production entries during ticks.
 * Belongs here: server-side production completion transitions.
 * Does not belong here: UI progress bars or scheduler code.
 */
export const completeProduction = (
  state: CoreGameState,
  context: GameCoreContext
): CoreGameState => {
  const productionBuildings = context.config.balance.productionBuildings;

  if (!productionBuildings || Object.keys(productionBuildings).length <= 0) {
    return state;
  }

  let nextResourceStates = state.resourceStatesById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    const profile = productionBuildings[building.buildingTypeId];

    if (!profile || building.status !== "active") {
      continue;
    }

    const resourceStateId = composeEntityId("resource", building.id);
    const currentState = state.resourceStatesById[resourceStateId] ?? {
      id: resourceStateId,
      ownerType: "building" as const,
      ownerId: building.id,
      balances: {
        [profile.resourceKey]: 0
      },
      incomeModifiers: {},
      lastUpdatedTick: Math.max(0, state.root.tick - 1),
      version: 0
    };
    const elapsedTicks = Math.max(0, state.root.tick - currentState.lastUpdatedTick);

    if (elapsedTicks <= 0) {
      continue;
    }

    const productionTarget = building.buildingTypeId === "factory" ? "factoryProductionSpeed" : null;
    const factionProductionMultiplier = resolveFactionProductionMultiplier(
      profile.resourceKey,
      building.buildingTypeId,
      getFactionPassiveModifiers(state, building.ownerPlayerId, context)
    );
    const infrastructureMultiplier = productionTarget
      ? resolvePowerStationInfrastructureMultiplier({
          state,
          playerId: building.ownerPlayerId,
          config: context.config.balance.powerStation,
          tick: state.root.tick,
          target: productionTarget
        })
      : 1;
    const levelMultiplier = resolveProductionBuildingLevelMultiplier(building, context);
    const baseProducedPerTick = Math.max(
      0,
      Math.floor(
        profile.amountPerTick
          * context.config.balance.productionMultiplier
          * levelMultiplier
          * infrastructureMultiplier
          * factionProductionMultiplier
      )
    );
    const producedPerTick = Math.max(0, applyDayNightProductionMultiplier({
      state,
      context,
      buildingTypeId: building.buildingTypeId,
      amountPerTick: baseProducedPerTick
    }));
    const currentAmount = Math.max(0, Number(currentState.balances[profile.resourceKey] || 0));
    const nextAmount = Math.min(profile.storageCap, currentAmount + producedPerTick * elapsedTicks);

    nextResourceStates = {
      ...nextResourceStates,
      [resourceStateId]: {
        ...currentState,
        balances: {
          ...currentState.balances,
          [profile.resourceKey]: nextAmount
        },
        lastUpdatedTick: state.root.tick,
        version: currentState.version + 1
      }
    };
    changed = true;
  }

  return changed
    ? {
        ...state,
        resourceStatesById: nextResourceStates
      }
    : state;
};
