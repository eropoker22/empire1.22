import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { composeEntityId } from "../../utils";

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

    const producedPerTick = Math.max(
      0,
      Math.floor(profile.amountPerTick * context.config.balance.productionMultiplier)
    );
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
