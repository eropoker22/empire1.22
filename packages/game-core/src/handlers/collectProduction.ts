import type { CollectProductionCommand, Notification, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { createEvent, createNotification, CORE_EVENT_TYPES } from "../events";
import type { GameCoreContext } from "../engine/context";
import { validateCollect } from "../validation";
import { composeEntityId } from "../utils";
import {
  getWarehouseCapacityForResource,
  normalizeStorageBalances,
  resolveWarehouseStorageCapacity
} from "./warehouseBuilding";
import { collectPharmacyProduction } from "./pharmacyProductionHandlers";
import { collectDrugLabProduction } from "./drugLabProductionHandlers";
import { collectAllFactoryProduction, collectFactoryProduction } from "./factoryProductionHandlers";
import { collectAllArmoryProduction, collectArmoryProduction } from "./armoryProductionHandlers";

/**
 * Responsibility: Placeholder handler for production collection commands.
 * Belongs here: orchestration of collect-production state transitions.
 * Does not belong here: UI or persistence concerns.
 */
export const handleCollectProduction = (
  state: CoreGameState,
  command: CollectProductionCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const targetBuilding = state.buildingsById[command.payload.buildingId];
  if (targetBuilding?.buildingTypeId === "pharmacy") {
    return attachProductionCollectionReport(collectPharmacyProduction(state, {
      ...command,
      payload: {
        ...command.payload,
        recipeId: command.payload.resourceKey || ""
      }
    }, context), command, targetBuilding.buildingTypeId);
  }
  if (targetBuilding?.buildingTypeId === "drug_lab") {
    return attachProductionCollectionReport(collectDrugLabProduction(state, {
      ...command,
      payload: {
        ...command.payload,
        recipeId: command.payload.resourceKey || ""
      }
    }, context), command, targetBuilding.buildingTypeId);
  }
  if (targetBuilding?.buildingTypeId === "factory") {
    const result = command.payload.resourceKey
      ? collectFactoryProduction(state, {
          ...command,
          payload: { ...command.payload, recipeId: command.payload.resourceKey }
        }, context)
      : collectAllFactoryProduction(state, command, context);
    return attachProductionCollectionReport(result, command, targetBuilding.buildingTypeId);
  }
  if (targetBuilding?.buildingTypeId === "armory") {
    const result = command.payload.resourceKey
      ? collectArmoryProduction(state, {
          ...command,
          payload: { ...command.payload, recipeId: command.payload.resourceKey }
        }, context)
      : collectAllArmoryProduction(state, command, context);
    return attachProductionCollectionReport(result, command, targetBuilding.buildingTypeId);
  }
  const errors = validateCollect(state, command, context);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const building = state.buildingsById[command.payload.buildingId];
  const player = state.playersById[command.playerId];
  const productionProfile = context.config.balance.productionBuildings?.[building.buildingTypeId];

  if (!productionProfile) {
    return {
      nextState: state,
      events: [],
      errors: [
        {
          code: "production_not_supported",
          message: "The target building does not support migrated production collection."
        }
      ]
    };
  }

  const buildingResourceStateId = composeEntityId("resource", building.id);
  const buildingResourceState = state.resourceStatesById[buildingResourceStateId];
  const collectedAmount = Math.max(
    0,
    Number(buildingResourceState?.balances?.[productionProfile?.resourceKey || ""] || 0)
  );
  const storedPlayerResourceState = state.resourceStatesById[player.resourceStateId];
  const playerResourceState = storedPlayerResourceState
    ? { ...storedPlayerResourceState, balances: normalizeStorageBalances(storedPlayerResourceState.balances) }
    : createPlayerResourceState(player, state.root.tick);
  const warehouseCapacity = context.config.balance.warehouse
    ? resolveWarehouseStorageCapacity(state, player.id, context.config.balance.warehouse)
    : null;
  const resourceCapacity = warehouseCapacity
    ? getWarehouseCapacityForResource(warehouseCapacity, productionProfile.resourceKey)
    : Number.POSITIVE_INFINITY;
  const currentPlayerAmount = Math.max(0, Number(playerResourceState.balances[productionProfile.resourceKey] || 0));
  const acceptedAmount = Number.isFinite(resourceCapacity)
    ? Math.max(0, Math.min(collectedAmount, resourceCapacity - currentPlayerAmount))
    : collectedAmount;
  const remainingAmount = Math.max(0, collectedAmount - acceptedAmount);

  if (acceptedAmount <= 0) {
    return {
      nextState: state,
      events: [],
      errors: [
        {
          code: "storage_capacity_full",
          message: "Sklad je pro tuto položku plný."
        }
      ]
    };
  }

  const nextBuildingResourceState: ResourceState = {
    ...(buildingResourceState as ResourceState),
    balances: {
      ...buildingResourceState.balances,
      [productionProfile.resourceKey]: remainingAmount
    },
    lastUpdatedTick: state.root.tick,
    version: buildingResourceState.version + 1
  };

  const nextPlayerResourceState: ResourceState = {
    ...playerResourceState,
    balances: {
      ...playerResourceState.balances,
      [productionProfile.resourceKey]: Math.max(
        0,
        currentPlayerAmount + acceptedAmount
      )
    },
    lastUpdatedTick: state.root.tick,
    version: playerResourceState.version + (storedPlayerResourceState ? 1 : 0)
  };

  return attachProductionCollectionReport({
    nextState: {
      ...state,
      resourceStatesById: {
        ...state.resourceStatesById,
        [buildingResourceStateId]: nextBuildingResourceState,
        [playerResourceState.id]: nextPlayerResourceState
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.productionCollected, {
        playerId: command.playerId,
        districtId: command.payload.districtId,
        buildingId: command.payload.buildingId,
        resourceKey: productionProfile.resourceKey,
        amount: acceptedAmount
      })
    ],
    errors: []
  }, command, building.buildingTypeId);
};

const attachProductionCollectionReport = (
  result: { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] },
  command: CollectProductionCommand,
  buildingTypeId: string
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  if (result.errors.length > 0) {
    return result;
  }

  const collectedResources = result.events
    .filter((event) => event.type === CORE_EVENT_TYPES.productionCollected)
    .map((event) => event.payload as { resourceKey?: unknown; amount?: unknown })
    .reduce<Record<string, number>>((resources, payload) => {
      const resourceKey = String(payload.resourceKey || "").trim();
      const amount = Math.max(0, Number(payload.amount || 0));
      if (resourceKey && amount > 0) {
        resources[resourceKey] = Number(resources[resourceKey] || 0) + amount;
      }
      return resources;
    }, {});

  if (Object.keys(collectedResources).length === 0) {
    return result;
  }

  const notification = createProductionCollectionNotification({
    command,
    buildingTypeId,
    collectedResources,
    tick: result.nextState.root.tick
  });
  const notificationAlreadyStored = Boolean(result.nextState.notificationsById[notification.id]);

  return {
    ...result,
    nextState: {
      ...result.nextState,
      notificationsById: {
        ...result.nextState.notificationsById,
        [notification.id]: notification
      },
      root: notificationAlreadyStored
        ? result.nextState.root
        : {
            ...result.nextState.root,
            notificationIds: [...result.nextState.root.notificationIds, notification.id],
            version: result.nextState.root.version + 1
          }
    }
  };
};

const createProductionCollectionNotification = ({
  command,
  buildingTypeId,
  collectedResources,
  tick
}: {
  command: CollectProductionCommand;
  buildingTypeId: string;
  collectedResources: Record<string, number>;
  tick: number;
}): Notification => createNotification({
  id: composeEntityId("notification", `${command.id}:production-collection-report`),
  recipientType: "player",
  recipientId: command.playerId,
  category: "report.building-action",
  title: "Výběr produkce",
  bodyKey: "report.building-action",
  payload: {
    reportId: composeEntityId("report", `${command.id}:production-collection`),
    reportType: "building-action",
    actionType: "collect-production",
    playerId: command.playerId,
    districtId: command.payload.districtId,
    buildingId: command.payload.buildingId,
    buildingTypeId,
    buildingType: buildingTypeId,
    buildingActionId: "collect-production",
    actionId: "collect-production",
    result: "success",
    success: true,
    inputCost: {},
    outputGain: collectedResources,
    resourceDelta: collectedResources,
    producedItems: collectedResources,
    consumedItems: {},
    message: "Hotová produkce byla přesunuta do skladu.",
    tick,
    createdAt: new Date(0).toISOString(),
    eventId: command.id
  },
  createdAt: new Date(0).toISOString(),
  readAt: null
});

const createPlayerResourceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});
