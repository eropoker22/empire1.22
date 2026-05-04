import type { ActiveEffect, Notification, ResourceState, RunBuildingActionCommand } from "@empire/shared-types";
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
import { resolveArcadeAction } from "./arcadeBuildingActions";
import { resolveApartmentBlockAction } from "./apartmentBlockBuildingActions";
import { resolveCasinoAction } from "./casinoBuildingActions";
import { resolveClinicAction } from "./clinicBuildingActions";
import { resolveExchangeOfficeAction } from "./exchangeOfficeBuildingActions";
import {
  applyCarDealerCooldownReductionTicks,
  resolveCarDealerCategoryForBuildingAction
} from "./carDealerBuildingActions";
import {
  applyGarageCooldownReductionTicks,
  resolveGarageCategoryForBuildingAction
} from "./garageBuildingActions";
import { resolvePowerStationAction } from "./powerStationBuildingActions";
import { resolveRecyclingCenterAction } from "./recyclingCenterBuildingActions";
import { resolveSmugglingTunnelAction } from "./smugglingTunnelBuildingActions";
import { resolveStripClubAction } from "./stripClubBuildingActions";
import { createPlayerPoliceState, resolveWantedLevel } from "./playerPoliceState";

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
  let nextBalances = {
    ...currentPlayerResourceState.balances
  };
  const casinoResolution = context.config.balance.casino
    ? resolveCasinoAction({
        state,
        building,
        action,
        balances: nextBalances,
        casinoConfig: context.config.balance.casino,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id
      })
    : null;
  const exchangeOfficeResolution = !casinoResolution && context.config.balance.exchangeOffice
    ? resolveExchangeOfficeAction({
        state,
        building,
        action,
        balances: nextBalances,
        exchangeConfig: context.config.balance.exchangeOffice,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const arcadeResolution = !casinoResolution && !exchangeOfficeResolution && context.config.balance.arcade
    ? resolveArcadeAction({
        state,
        building,
        action,
        balances: nextBalances,
        arcadeConfig: context.config.balance.arcade,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const apartmentBlockResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && context.config.balance.apartmentBlock
    ? resolveApartmentBlockAction({
        state,
        building,
        actionId: action.actionId,
        balances: nextBalances,
        apartmentConfig: context.config.balance.apartmentBlock
      })
    : null;
  const clinicResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && context.config.balance.clinic
    ? resolveClinicAction({
        state,
        playerId: player.id,
        actionId: action.actionId,
        balances: nextBalances,
        clinicConfig: context.config.balance.clinic,
        warehouseConfig: context.config.balance.warehouse,
        powerStationConfig: context.config.balance.powerStation,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const recyclingCenterResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && context.config.balance.recyclingCenter
    ? resolveRecyclingCenterAction({
        state,
        playerId: player.id,
        actionId: action.actionId,
        balances: nextBalances,
        recyclingCenterConfig: context.config.balance.recyclingCenter,
        warehouseConfig: context.config.balance.warehouse,
        powerStationConfig: context.config.balance.powerStation,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const stripClubResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && context.config.balance.stripClub
    ? resolveStripClubAction({
        state,
        building,
        action,
        balances: nextBalances,
        stripClubConfig: context.config.balance.stripClub,
        tickRateMs: context.config.tickRateMs,
        commandId: command.id
      })
    : null;
  const powerStationResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && context.config.balance.powerStation
    ? resolvePowerStationAction({
        state,
        building,
        action,
        balances: nextBalances,
        powerStationConfig: context.config.balance.powerStation,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const smugglingTunnelResolution = !casinoResolution && !exchangeOfficeResolution && !arcadeResolution && !apartmentBlockResolution && !clinicResolution && !recyclingCenterResolution && !stripClubResolution && !powerStationResolution && context.config.balance.smugglingTunnel
    ? resolveSmugglingTunnelAction({
        state,
        building,
        actionId: action.actionId,
        balances: nextBalances,
        config: context.config.balance.smugglingTunnel,
        tickRateMs: context.config.tickRateMs
      })
    : null;
  const specialResolution = casinoResolution ?? exchangeOfficeResolution ?? arcadeResolution ?? apartmentBlockResolution ?? clinicResolution ?? recyclingCenterResolution ?? stripClubResolution ?? powerStationResolution ?? smugglingTunnelResolution;
  const resolvedAction: BuildingActionBalanceConfig = specialResolution
    ? {
        ...action,
        inputCost: specialResolution.inputCost,
        outputGain: specialResolution.outputGain,
        heatGain: specialResolution.heatGain,
        influenceChange: specialResolution.influenceChange,
        effectModifiers: specialResolution.effectModifiers ?? action.effectModifiers,
        reportText: specialResolution.reportText
      }
    : action;

  if (specialResolution) {
    nextBalances = specialResolution.balances;
  } else {
    for (const [resourceKey, amount] of Object.entries(action.inputCost)) {
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) - amount);
    }

    for (const [resourceKey, amount] of Object.entries(action.outputGain)) {
      if (resourceKey === "population") {
        continue;
      }
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
    }
  }
  const populationGain = Math.max(0, Math.floor(Number(resolvedAction.outputGain.population || 0)));

  const nextPlayerResourceState: ResourceState = {
    ...currentPlayerResourceState,
    balances: nextBalances,
    lastUpdatedTick: state.root.tick,
    version: currentPlayerResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
  };
  const cooldownTicks = resolveBuildingActionCooldownTicks({
    action,
    state,
    playerId: player.id,
    buildingTypeId: building.buildingTypeId,
    context
  });
  const nextBuilding = {
    ...building,
    metadata: specialResolution?.buildingMetadata ?? building.metadata,
    actionCooldowns: {
      ...(building.actionCooldowns ?? {}),
      [resolvedAction.actionId]: state.root.tick + cooldownTicks
    },
    version: building.version + 1
  };
  const baseNextDistrict = {
    ...district,
    heat: Math.max(0, Number(district.heat || 0) + resolvedAction.heatGain),
    influence: Math.max(0, Number(district.influence || 0) + resolvedAction.influenceChange),
    version: district.version + 1
  };
  const specialEffect = resolveBuildingActionSpecialEffect({
    state,
    district: baseNextDistrict,
    actionId: resolvedAction.actionId
  });
  const nextDistrict = specialEffect.nextDistrict;
  const nextPlayer = {
    ...player,
    ...(populationGain > 0
      ? { population: Math.max(0, Number(player.population || 0) + populationGain) }
      : {}),
    ...(clinicResolution ? { recoveryPool: clinicResolution.playerRecoveryPool } : {}),
    ...(recyclingCenterResolution ? { salvagePool: recyclingCenterResolution.playerSalvagePool } : {}),
    lastActionAt: command.issuedAt,
    version: player.version + 1
  };
  const currentPoliceState = state.policeStatesById[player.policeStateId] ?? createPlayerPoliceState(player, state.root.tick);
  const nextPoliceState = {
    ...currentPoliceState,
    heat: Math.max(0, Number(currentPoliceState.heat || 0) + resolvedAction.heatGain),
    wantedLevel: resolveWantedLevel(Math.max(0, Number(currentPoliceState.heat || 0) + resolvedAction.heatGain)),
    version: currentPoliceState.version + (state.policeStatesById[player.policeStateId] ? 1 : 0)
  };
  const eventId = composeEntityId("event", `${command.id}:building-action`);
  const notification = createBuildingActionReportNotification({
    command,
    action: resolvedAction,
    districtId: district.id,
    buildingId: building.id,
    buildingTypeId: building.buildingTypeId,
    playerId: player.id,
    specialEffect,
    tick: state.root.tick,
    eventId,
    casinoResult: casinoResolution?.casinoResult,
    exchangeResult: exchangeOfficeResolution?.exchangeResult,
    arcadeResult: arcadeResolution?.arcadeResult,
    apartmentResult: apartmentBlockResolution?.apartmentResult,
    clinicResult: clinicResolution?.clinicResult,
    recyclingResult: recyclingCenterResolution?.recyclingResult,
    stripClubResult: stripClubResolution?.stripClubResult,
    powerStationResult: powerStationResolution?.powerStationResult,
    smugglingTunnelResult: smugglingTunnelResolution?.smugglingTunnelResult
  });
  const nextEffectState = createDistrictBuildingActionEffectState({
    state,
    command,
    districtId: district.id,
    buildingId: building.id,
    action: resolvedAction,
    context
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
      policeStatesById: {
        ...state.policeStatesById,
        [nextPoliceState.id]: nextPoliceState
      },
      effectStatesById: nextEffectState
        ? {
            ...state.effectStatesById,
            [nextEffectState.id]: nextEffectState
          }
        : state.effectStatesById,
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
        actionId: resolvedAction.actionId,
        outputGain: resolvedAction.outputGain,
        heatGain: resolvedAction.heatGain,
        influenceChange: resolvedAction.influenceChange,
        effectModifiers: resolvedAction.effectModifiers,
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

const resolveBuildingActionCooldownTicks = (input: {
  action: BuildingActionBalanceConfig;
  state: CoreGameState;
  playerId: string;
  buildingTypeId: string;
  context: GameCoreContext;
}): number => {
  const { action, context } = input;
  const cooldownMs = Math.max(0, Number(action.cooldownMs || action.durationMs || 0));
  if (cooldownMs <= 0) {
    return 0;
  }
  const rawTicks = Math.ceil(cooldownMs / Math.max(1, context.config.tickRateMs));
  const baseTicks = Math.max(1, Math.ceil(rawTicks * context.config.balance.cooldownMultiplier));
  const carDealerCategory = resolveCarDealerCategoryForBuildingAction(input.buildingTypeId, action.actionId);
  if (carDealerCategory) {
    return applyCarDealerCooldownReductionTicks({
      baseTicks,
      state: input.state,
      playerId: input.playerId,
      config: context.config.balance.carDealer,
      garageConfig: context.config.balance.garage,
      category: carDealerCategory
    });
  }
  const garageCategory = resolveGarageCategoryForBuildingAction(input.buildingTypeId, action.actionId);
  return garageCategory
    ? applyGarageCooldownReductionTicks({
        baseTicks,
        state: input.state,
        playerId: input.playerId,
        config: context.config.balance.garage,
        category: garageCategory
      })
    : baseTicks;
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

const createDistrictBuildingActionEffectState = (input: {
  state: CoreGameState;
  command: RunBuildingActionCommand;
  districtId: string;
  buildingId: string;
  action: BuildingActionBalanceConfig;
  context: GameCoreContext;
}) => {
  const modifiers = input.action.effectModifiers;
  if (!modifiers || input.action.durationMs <= 0) {
    return null;
  }

  const effectStateId = composeEntityId("effect", input.districtId);
  const current = input.state.effectStatesById[effectStateId] ?? {
    id: effectStateId,
    ownerType: "district" as const,
    ownerId: input.districtId,
    effects: [],
    version: 0
  };
  const durationTicks = Math.max(
    1,
    Math.ceil(Math.max(0, input.action.durationMs) / Math.max(1, input.context.config.tickRateMs))
  );
  const activeEffect: ActiveEffect = {
    effectId: composeEntityId("effect", `${input.command.id}:${input.action.actionId}`),
    effectType: "building_action_effect",
    sourceType: "building",
    sourceId: input.buildingId,
    startedAtTick: input.state.root.tick,
    expiresAtTick: input.state.root.tick + durationTicks,
    stackPolicyKey: input.action.actionId,
    payload: {
      actionId: input.action.actionId,
      label: input.action.label,
      durationMs: input.action.durationMs,
      effectModifiers: {
        ...modifiers
      },
      ...modifiers
    }
  };

  return {
    ...current,
    effects: [
      ...current.effects.filter((effect) => effect.expiresAtTick === null || effect.expiresAtTick > input.state.root.tick),
      activeEffect
    ],
    version: current.version + 1
  };
};

const createBuildingActionReportNotification = (input: {
  command: RunBuildingActionCommand;
  action: BuildingActionBalanceConfig;
  districtId: string;
  buildingId: string;
  buildingTypeId: string;
  playerId: string;
  specialEffect: BuildingActionSpecialEffectResult;
  casinoResult?: Record<string, unknown>;
  exchangeResult?: Record<string, unknown>;
  arcadeResult?: Record<string, unknown>;
  apartmentResult?: Record<string, unknown>;
  clinicResult?: Record<string, unknown>;
  recyclingResult?: Record<string, unknown>;
  stripClubResult?: Record<string, unknown>;
  powerStationResult?: Record<string, unknown>;
  smugglingTunnelResult?: Record<string, unknown>;
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
      casinoResult: input.casinoResult,
      exchangeResult: input.exchangeResult,
      arcadeResult: input.arcadeResult,
      apartmentResult: input.apartmentResult,
      clinicResult: input.clinicResult,
      recyclingResult: input.recyclingResult,
      stripClubResult: input.stripClubResult,
      powerStationResult: input.powerStationResult,
      smugglingTunnelResult: input.smugglingTunnelResult,
      heatGain: input.action.heatGain,
      influenceChange: input.action.influenceChange,
      effectModifiers: input.action.effectModifiers,
      reportText: input.action.reportText,
      tick: input.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });
