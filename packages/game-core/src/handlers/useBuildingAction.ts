import type { ActiveEffect, ResourceState, RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { composeEntityId } from "../utils";
import { validateRunBuildingAction } from "../validation";
import { resolveBuildingActionSpecificResolution } from "./buildingActionSpecificResolution";
import { resolveCityHallInfluenceActionCostReductionPct } from "./cityHallBuildingActions";
import { resolveBuildingActionSpecialEffect } from "./buildingActionSpecialEffects";
import {
  createBuildingActionReportNotification,
  createResourceDelta,
  sanitizeNumber,
  sanitizeNumberRecord
} from "./buildingActionReportNotification";
import { resolveCentralBankInfluenceActionCostReductionPct } from "./centralBankBuildingActions";
import {
  applyCarDealerCooldownReductionTicks,
  resolveCarDealerCategoryForBuildingAction
} from "./carDealerBuildingActions";
import {
  applyGarageCooldownReductionTicks,
  resolveGarageCategoryForBuildingAction
} from "./garageBuildingActions";
import {
  consumeLobbyClubNextInfluenceDiscount,
  getOwnedLobbyClubCount,
  hasLobbyClubNextInfluenceDiscount,
  resolveLobbyClubInfluenceActionCostReductionPct
} from "./lobbyClubBuildingActions";
import { createPlayerPoliceState, resolveWantedLevel } from "./playerPoliceState";
import {
  applyFactionHeatGain,
  applyFactionIllegalActionHeatGain,
  applyFactionInfluenceGain,
  getFactionPassiveModifiers,
  isFactionIllegalActionBuilding
} from "../rules/factions/factionRules";
import { resolveEffectiveBuildingActionPreview } from "../rules/buildings/buildingActionCosts";
import {
  resolveBuildingActionStorageError,
  resolveNormalizedPlayerResourceState
} from "./buildingActionStorage";

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

  const { resourceState: currentPlayerResourceState, existed: hadPlayerResourceState } = resolveNormalizedPlayerResourceState(state, player, state.root.tick);
  let nextBalances = {
    ...currentPlayerResourceState.balances
  };
  const {
    casinoResolution,
    exchangeOfficeResolution,
    arcadeResolution,
    apartmentBlockResolution,
    clinicResolution,
    recyclingCenterResolution,
    stripClubResolution,
    powerStationResolution,
    smugglingTunnelResolution,
    stockExchangeResolution,
    airportResolution,
    cityHallResolution,
    centralBankResolution,
    schoolResolution,
    lobbyClubResolution,
    streetDealersResolution,
    specialResolution
  } = resolveBuildingActionSpecificResolution({
    state,
    command,
    context,
    player,
    district,
    building,
    action,
    balances: nextBalances
  });
  let resolvedAction: BuildingActionBalanceConfig = specialResolution
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
  const cityHallInfluenceReductionPct = building.buildingTypeId !== "city_hall" && resolvedAction.influenceChange < 0
    ? resolveCityHallInfluenceActionCostReductionPct({
        state,
        playerId: player.id,
        config: context.config.balance.cityHall
      })
    : 0;
  const centralBankInfluenceReductionPct = building.buildingTypeId !== "central_bank" && resolvedAction.influenceChange < 0
    ? resolveCentralBankInfluenceActionCostReductionPct({
        state,
        playerId: player.id,
        config: context.config.balance.centralBank
      })
    : 0;
  const lobbyClubInfluenceReductionPct = building.buildingTypeId !== "lobby_club" && resolvedAction.influenceChange < 0
    ? resolveLobbyClubInfluenceActionCostReductionPct({
        state,
        playerId: player.id,
        config: context.config.balance.lobbyClub,
        tick: state.root.tick
      })
    : 0;
  const lobbyClubNextDiscountConsumed = building.buildingTypeId !== "lobby_club" && resolvedAction.influenceChange < 0
    ? hasLobbyClubNextInfluenceDiscount({
        state,
        playerId: player.id,
        config: context.config.balance.lobbyClub,
        tick: state.root.tick
      })
    : false;
  const influenceReductionPct = Math.min(25, cityHallInfluenceReductionPct + centralBankInfluenceReductionPct + lobbyClubInfluenceReductionPct);
  if (influenceReductionPct > 0) {
    resolvedAction = {
      ...resolvedAction,
      influenceChange: -Math.ceil(Math.abs(resolvedAction.influenceChange) * (1 - influenceReductionPct / 100))
    };
  }
  const originalPhaseInputCost = { ...resolvedAction.inputCost };
  const originalPhaseOutputGain = { ...resolvedAction.outputGain };
  const effectivePreview = resolveEffectiveBuildingActionPreview({
    action: resolvedAction,
    state,
    context,
    buildingTypeId: building.buildingTypeId
  });
  resolvedAction = {
    ...resolvedAction,
    durationMs: effectivePreview.effectiveDurationMs,
    cooldownMs: effectivePreview.effectiveCooldownMs,
    heatGain: effectivePreview.effectiveHeatGain,
    inputCost: effectivePreview.effectiveInputCost,
    outputGain: effectivePreview.effectiveOutputGain
  };
  const factionModifiers = getFactionPassiveModifiers(state, player.id, context);
  const adjustedHeatGain = resolvedAction.heatGain < 0
    ? resolvedAction.heatGain
    : isFactionIllegalActionBuilding(building.buildingTypeId)
      ? applyFactionIllegalActionHeatGain(resolvedAction.heatGain, factionModifiers)
      : applyFactionHeatGain(resolvedAction.heatGain, factionModifiers);
  resolvedAction = {
    ...resolvedAction,
    heatGain: adjustedHeatGain,
    influenceChange: applyFactionInfluenceGain(resolvedAction.influenceChange, factionModifiers)
  };

  const storageError = specialResolution ? null : resolveBuildingActionStorageError({ state, playerId: player.id, outputGain: resolvedAction.outputGain, context });
  if (storageError) {
    return { nextState: state, events: [], errors: [storageError] };
  }

  if (specialResolution) {
    nextBalances = reconcileDayNightSpecialBalances({
      balances: specialResolution.balances,
      originalInputCost: originalPhaseInputCost,
      adjustedInputCost: resolvedAction.inputCost,
      originalOutputGain: originalPhaseOutputGain,
      adjustedOutputGain: resolvedAction.outputGain
    });
  } else {
    for (const [resourceKey, amount] of Object.entries(resolvedAction.inputCost)) {
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) - amount);
    }

    for (const [resourceKey, amount] of Object.entries(resolvedAction.outputGain)) {
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
    version: currentPlayerResourceState.version + (hadPlayerResourceState ? 1 : 0)
  };
  const cooldownTicks = resolveBuildingActionCooldownTicks({
    action: resolvedAction,
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
  const consumedLobbyDiscountPatches = lobbyClubNextDiscountConsumed
    ? consumeLobbyClubNextInfluenceDiscount({
        state,
        playerId: player.id,
        config: context.config.balance.lobbyClub,
        tick: state.root.tick
      })
    : {};
  const specialBuildingPatches = readSpecialBuildingPatches(specialResolution);
  const patchedBuildingsById = {
    ...state.buildingsById,
    ...specialBuildingPatches,
    ...consumedLobbyDiscountPatches,
    [building.id]: nextBuilding
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
    ...(streetDealersResolution ? { metadata: streetDealersResolution.playerMetadata } : {}),
    ...(smugglingTunnelResolution ? { metadata: smugglingTunnelResolution.playerMetadata } : {}),
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
  const effectiveCasinoResult = createEffectiveCasinoResult(casinoResolution?.casinoResult, resolvedAction);
  if (effectiveCasinoResult) {
    resolvedAction = {
      ...resolvedAction,
      reportText: createEffectiveCasinoReportText(effectiveCasinoResult, resolvedAction.reportText)
    };
  }
  const effectiveExchangeResult = createEffectiveExchangeOfficeResult(exchangeOfficeResolution?.exchangeResult, resolvedAction);
  if (effectiveExchangeResult) {
    resolvedAction = {
      ...resolvedAction,
      reportText: createEffectiveExchangeOfficeReportText(effectiveExchangeResult)
    };
  }
  const eventId = composeEntityId("event", `${command.id}:building-action`);
  const notification = createBuildingActionReportNotification({
    command,
    action: resolvedAction,
    districtId: district.id,
    buildingId: building.id,
    buildingTypeId: building.buildingTypeId,
    playerId: player.id,
    cooldownUntilTick: nextBuilding.actionCooldowns[resolvedAction.actionId] ?? state.root.tick,
    specialEffect,
    tick: state.root.tick,
    eventId,
    policeImpact: {
      playerHeat: nextPoliceState.heat,
      wantedLevel: nextPoliceState.wantedLevel,
      heatDelta: resolvedAction.heatGain
    },
    casinoResult: effectiveCasinoResult,
    exchangeResult: effectiveExchangeResult,
    arcadeResult: arcadeResolution?.arcadeResult,
    apartmentResult: apartmentBlockResolution?.apartmentResult,
    clinicResult: clinicResolution?.clinicResult,
    recyclingResult: recyclingCenterResolution?.recyclingResult,
    stripClubResult: stripClubResolution?.stripClubResult,
    powerStationResult: powerStationResolution?.powerStationResult,
    smugglingTunnelResult: smugglingTunnelResolution?.smugglingTunnelResult,
    airportResult: airportResolution?.airportResult,
    cityHallResult: cityHallResolution?.cityHallResult,
    centralBankResult: centralBankResolution?.centralBankResult,
    lobbyClubResult: lobbyClubResolution?.lobbyClubResult,
    stockExchangeResult: stockExchangeResolution?.stockExchangeResult,
    schoolResult: schoolResolution?.schoolResult,
    streetDealerResult: streetDealersResolution?.streetDealerResult
  });
  const nextEffectState = createDistrictBuildingActionEffectState({
    state,
    command,
    districtId: district.id,
    buildingId: building.id,
    action: resolvedAction,
    context
  });
  const actionResourceDelta = createResourceDelta(resolvedAction.inputCost, resolvedAction.outputGain);

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
        ...patchedBuildingsById
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
        outputGain: sanitizeNumberRecord(resolvedAction.outputGain),
        inputCost: sanitizeNumberRecord(resolvedAction.inputCost),
        resourceDelta: actionResourceDelta,
        cashDelta: actionResourceDelta.cash ?? 0,
        dirtyCashDelta: actionResourceDelta["dirty-cash"] ?? 0,
        heatGain: sanitizeNumber(resolvedAction.heatGain),
        influenceChange: sanitizeNumber(resolvedAction.influenceChange),
        effectModifiers: resolvedAction.effectModifiers,
        defenseAdded: specialEffect.defenseAdded,
        intelRevealedDistrictIds: specialEffect.intelRevealedDistrictIds,
        airportResult: airportResolution?.airportResult,
        cityHallResult: cityHallResolution?.cityHallResult,
        centralBankResult: centralBankResolution?.centralBankResult,
        lobbyClubResult: lobbyClubResolution?.lobbyClubResult,
        stockExchangeResult: stockExchangeResolution?.stockExchangeResult,
        reportText: resolvedAction.reportText,
        eventId
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

const createEffectiveCasinoResult = (
  rawResult: Record<string, unknown> | undefined,
  action: BuildingActionBalanceConfig
): Record<string, unknown> | undefined => {
  if (!rawResult) {
    return undefined;
  }
  if (rawResult.type === "laundering") {
    const launderedDirtyCash = Math.max(0, Number(action.inputCost["dirty-cash"] || 0));
    const cleanCashGained = Math.max(0, Number(action.outputGain.cash || 0));
    return {
      ...rawResult,
      launderedDirtyCash,
      cleanCashGained,
      feePaid: Math.max(0, launderedDirtyCash - cleanCashGained),
      heatGain: sanitizeNumber(action.heatGain),
      influenceGain: sanitizeNumber(action.influenceChange)
    };
  }
  if (rawResult.type === "heat_control") {
    const heatGain = sanitizeNumber(action.heatGain);
    return {
      ...rawResult,
      costPaid: Math.max(0, Number(action.inputCost.cash || 0)),
      ...(heatGain < 0 ? { heatReduction: Math.abs(heatGain) } : { heatGain })
    };
  }
  return rawResult;
};

const createEffectiveCasinoReportText = (
  result: Record<string, unknown>,
  fallback: string
): string => {
  if (result.type === "laundering") {
    const launderedDirtyCash = Math.max(0, Number(result.launderedDirtyCash || 0));
    const cleanCashGained = Math.max(0, Number(result.cleanCashGained || 0));
    const feePaid = Math.max(0, Number(result.feePaid || 0));
    const heatGain = sanitizeNumber(result.heatGain);
    return `Tichá herna vyprala ${formatReportNumber(launderedDirtyCash)} dirty cash na ${formatReportNumber(cleanCashGained)} clean cash. Poplatek ${formatReportNumber(feePaid)}. Heat ${heatGain >= 0 ? "+" : ""}${formatReportNumber(heatGain)}.`;
  }
  return fallback;
};

const createEffectiveExchangeOfficeResult = (
  rawResult: Record<string, unknown> | undefined,
  action: BuildingActionBalanceConfig
): Record<string, unknown> | undefined => {
  if (!rawResult) {
    return undefined;
  }
  const launderedDirtyCash = Math.max(0, Number(action.inputCost["dirty-cash"] || 0));
  const cleanCashGained = Math.max(0, Number(action.outputGain.cash || 0));
  return {
    ...rawResult,
    launderedDirtyCash,
    cleanCashGained,
    feePaid: Math.max(0, launderedDirtyCash - cleanCashGained),
    heatGain: sanitizeNumber(action.heatGain),
    influenceGain: sanitizeNumber(action.influenceChange)
  };
};

const createEffectiveExchangeOfficeReportText = (result: Record<string, unknown>): string => {
  const launderedDirtyCash = Math.max(0, Number(result.launderedDirtyCash || 0));
  const cleanCashGained = Math.max(0, Number(result.cleanCashGained || 0));
  const feePaid = Math.max(0, Number(result.feePaid || 0));
  const heatGain = sanitizeNumber(result.heatGain);
  return `Výhodný kurz vypral ${formatReportNumber(launderedDirtyCash)} dirty cash na ${formatReportNumber(cleanCashGained)} clean cash. Poplatek ${formatReportNumber(feePaid)}. Heat ${heatGain >= 0 ? "+" : ""}${formatReportNumber(heatGain)}.`;
};

const formatReportNumber = (value: number): string => {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/u, "");
};

const reconcileDayNightSpecialBalances = (input: {
  balances: Record<string, number>;
  originalInputCost: Record<string, number>;
  adjustedInputCost: Record<string, number>;
  originalOutputGain: Record<string, number>;
  adjustedOutputGain: Record<string, number>;
}): Record<string, number> => {
  const nextBalances = { ...input.balances };
  const resourceKeys = new Set([
    ...Object.keys(input.originalInputCost),
    ...Object.keys(input.adjustedInputCost),
    ...Object.keys(input.originalOutputGain),
    ...Object.keys(input.adjustedOutputGain)
  ]);
  for (const resourceKey of resourceKeys) {
    if (resourceKey === "population") continue;
    const originalCost = Math.max(0, Number(input.originalInputCost[resourceKey] || 0));
    const adjustedCost = Math.max(0, Number(input.adjustedInputCost[resourceKey] || 0));
    const originalGain = Math.max(0, Number(input.originalOutputGain[resourceKey] || 0));
    const adjustedGain = Math.max(0, Number(input.adjustedOutputGain[resourceKey] || 0));
    const delta = originalCost - adjustedCost + adjustedGain - originalGain;
    if (delta !== 0) {
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + delta);
    }
  }
  return nextBalances;
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
  const lobbyCityHallCooldownReductionTicks = context.config.balance.lobbyClub
    && context.config.balance.cityHall
    && input.buildingTypeId === context.config.balance.cityHall.buildingTypeId
    && action.actionId === context.config.balance.cityHall.emergencyDecree.actionId
    && getOwnedLobbyClubCount(input.state, input.playerId, context.config.balance.lobbyClub) > 0
    ? Math.ceil(context.config.balance.lobbyClub.synergies.cityHallEmergencyDecreeCooldownMinutes * 60000 / Math.max(1, context.config.tickRateMs))
    : 0;
  const synergyAdjustedBaseTicks = Math.max(1, baseTicks - lobbyCityHallCooldownReductionTicks);
  const carDealerCategory = resolveCarDealerCategoryForBuildingAction(input.buildingTypeId, action.actionId);
  if (carDealerCategory) {
    return applyCarDealerCooldownReductionTicks({
      baseTicks: synergyAdjustedBaseTicks,
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
        baseTicks: synergyAdjustedBaseTicks,
        state: input.state,
        playerId: input.playerId,
        config: context.config.balance.garage,
        category: garageCategory
      })
    : synergyAdjustedBaseTicks;
};

const readSpecialBuildingPatches = (
  specialResolution: unknown
): Record<string, CoreGameState["buildingsById"][string]> =>
  specialResolution && typeof specialResolution === "object" && "buildingPatchesById" in specialResolution
    ? ((specialResolution as { buildingPatchesById?: Record<string, CoreGameState["buildingsById"][string]> }).buildingPatchesById ?? {})
    : {};

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
