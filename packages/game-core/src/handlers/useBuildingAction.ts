import type { Notification, ResourceState, RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import { composeEntityId } from "../utils";
import { validateRunBuildingAction } from "../validation";
import {
  type BuildingActionSpecialEffectResult,
  resolveBuildingActionSpecialEffect
} from "./buildingActionSpecialEffects";

/**
 * Responsibility: Placeholder handler for building-specific actions.
 * Belongs here: server-side orchestration for building action commands.
 * Does not belong here: UI shortcuts or admin overrides.
 */
export const handleUseBuildingAction = (
  state: CoreGameState,
  command: RunBuildingActionCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateRunBuildingAction(state, command, context);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const player = state.playersById[command.playerId];
  const district = state.districtsById[command.payload.districtId];
  const building = state.buildingsById[command.payload.buildingId];
  const action = context.config.balance.buildingActions?.[command.payload.actionId];

  if (!player || !district || !building || !action) {
    return {
      nextState: state,
      events: [],
      errors: [
        {
          code: "building_action_invalid_state",
          message: "Building action state changed before execution."
        }
      ]
    };
  }

  const currentPlayerResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
  const nextBalances = {
    ...currentPlayerResourceState.balances
  };

  for (const [resourceKey, amount] of Object.entries(action.inputCost)) {
    nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) - amount);
  }

  for (const [resourceKey, amount] of Object.entries(action.outputGain)) {
    nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
  }

  const nextPlayerResourceState: ResourceState = {
    ...currentPlayerResourceState,
    balances: nextBalances,
    lastUpdatedTick: state.root.tick,
    version: currentPlayerResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
  };
  const cooldownTicks = resolveBuildingActionCooldownTicks(action, context);
  const nextBuilding = {
    ...building,
    actionCooldowns: {
      ...(building.actionCooldowns ?? {}),
      [action.actionId]: state.root.tick + cooldownTicks
    },
    version: building.version + 1
  };
  const baseNextDistrict = {
    ...district,
    heat: Math.max(0, Number(district.heat || 0) + action.heatGain),
    influence: Math.max(0, Number(district.influence || 0) + action.influenceChange),
    version: district.version + 1
  };
  const specialEffect = resolveBuildingActionSpecialEffect({
    state,
    district: baseNextDistrict,
    actionId: action.actionId
  });
  const nextDistrict = specialEffect.nextDistrict;
  const nextPlayer = {
    ...player,
    lastActionAt: command.issuedAt,
    version: player.version + 1
  };
  const eventId = composeEntityId("event", `${command.id}:building-action`);
  const notification = createBuildingActionReportNotification({
    command,
    action,
    districtId: district.id,
    buildingId: building.id,
    buildingTypeId: building.buildingTypeId,
    playerId: player.id,
    specialEffect,
    tick: state.root.tick,
    eventId
  });

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: nextPlayer
      },
      districtsById: {
        ...state.districtsById,
        [district.id]: nextDistrict
      },
      buildingsById: {
        ...state.buildingsById,
        [building.id]: nextBuilding
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [nextPlayerResourceState.id]: nextPlayerResourceState
      },
      notificationsById: {
        ...state.notificationsById,
        [notification.id]: notification
      },
      root: {
        ...state.root,
        notificationIds: [...state.root.notificationIds, notification.id],
        version: state.root.version + 1
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.buildingActionResolved, {
        playerId: player.id,
        districtId: district.id,
        buildingId: building.id,
        buildingTypeId: building.buildingTypeId,
        actionId: action.actionId,
        outputGain: action.outputGain,
        heatGain: action.heatGain,
        influenceChange: action.influenceChange,
        defenseAdded: specialEffect.defenseAdded,
        intelRevealedDistrictIds: specialEffect.intelRevealedDistrictIds
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        recipientId: player.id,
        category: notification.category
      })
    ],
    errors: []
  };
};

const resolveBuildingActionCooldownTicks = (
  action: BuildingActionBalanceConfig,
  context: GameCoreContext
): number => {
  const cooldownMs = Math.max(0, Number(action.cooldownMs || action.durationMs || 0));
  const rawTicks = Math.ceil(cooldownMs / Math.max(1, context.config.tickRateMs));
  return Math.max(1, Math.ceil(rawTicks * context.config.balance.cooldownMultiplier));
};

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

const createBuildingActionReportNotification = (input: {
  command: RunBuildingActionCommand;
  action: BuildingActionBalanceConfig;
  districtId: string;
  buildingId: string;
  buildingTypeId: string;
  playerId: string;
  specialEffect: BuildingActionSpecialEffectResult;
  tick: number;
  eventId: string;
}): Notification =>
  createNotification({
    id: composeEntityId("notification", `${input.command.id}:building-action-report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.building-action",
    title: input.action.label,
    bodyKey: "report.building-action",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:building-action`),
      reportType: "building-action",
      actionType: "run-building-action",
      playerId: input.playerId,
      districtId: input.districtId,
      buildingId: input.buildingId,
      buildingTypeId: input.buildingTypeId,
      buildingActionId: input.action.actionId,
      actionLabel: input.action.label,
      result: "success",
      inputCost: input.action.inputCost,
      outputGain: input.action.outputGain,
      defenseAdded: input.specialEffect.defenseAdded,
      intelRevealedDistrictIds: input.specialEffect.intelRevealedDistrictIds,
      intelDetectedDefense: input.specialEffect.intelDetectedDefense,
      messages: input.specialEffect.messages,
      heatGain: input.action.heatGain,
      influenceChange: input.action.influenceChange,
      reportText: input.action.reportText,
      tick: input.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });
