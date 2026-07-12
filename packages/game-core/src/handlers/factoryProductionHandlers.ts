import type { CraftItemCommand, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { normalizeStorageBalances, calculateReceivableResourceAmount } from "./warehouseBuilding";
import { addCosts, creditCosts, debitCosts, equalCosts, hasRequiredResources, limitCosts, scaleCosts, subtractCosts } from "./productionLineCosts";
import { normalizeResourceCosts } from "./productionLineShared";
import { createFactoryPlayerResourceState, factoryFailure as failure, type FactoryHandlerResult, validateFactoryTarget } from "./factoryProductionSupport";
import { getFactoryBuildingResourceState, getFactoryLine, getFactoryProducedAmount, startFactoryLine } from "./factoryProductionShared";

type FactoryLineCommand = { playerId: string; payload: { districtId: string; buildingId: string; recipeId: string } };

export const handleFactoryProductionStart = (
  state: CoreGameState,
  command: CraftItemCommand,
  context: GameCoreContext
): FactoryHandlerResult => {
  const validation = validateFactoryTarget(state, command, context);
  if (validation.errors.length || !validation.building || !validation.recipe) return { nextState: state, events: [], errors: validation.errors };
  const quantity = Number(command.payload.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return failure(state, "factory_invalid_quantity", "Množství výroby musí být kladné celé číslo.");

  const { building, recipe } = validation;
  const line = getFactoryLine(building, command.payload.recipeId);
  if (getFactoryProducedAmount(state, building, recipe.outputResourceKey) >= recipe.localOutputCap) {
    return failure(state, "factory_output_full", "Lokální zásoba Továrny je plná.");
  }
  if (line.queuedAmount + quantity > recipe.queueCap) {
    return failure(state, "factory_queue_full", "Fronta této výrobní linky je plná.");
  }
  const player = state.playersById[command.playerId];
  if (!player) return failure(state, "factory_not_owned", "Hráč nevlastní cílovou Továrnu.");
  const stored = state.resourceStatesById[player.resourceStateId];
  const resources = stored
    ? { ...stored, balances: normalizeStorageBalances(stored.balances) }
    : createFactoryPlayerResourceState(player, state.root.tick);
  const cleanCost = quantity * recipe.cleanCashCostPerUnit;
  const inputCosts = scaleCosts(recipe.inputCosts, quantity);
  if (Math.max(0, Number(resources.balances.cash || 0)) < cleanCost) {
    return failure(state, "factory_insufficient_clean_cash", "Na spuštění výroby nemáš dost clean cash.");
  }
  if (!hasRequiredResources(resources.balances, inputCosts)) {
    return failure(state, "factory_missing_inputs", "Na spuštění výroby nemáš dost materiálových vstupů.");
  }
  if (line.queuedAmount && (
    line.unitCleanCashCost !== recipe.cleanCashCostPerUnit
    || !equalCosts(normalizeResourceCosts(line.unitResourceCosts), recipe.inputCosts)
  )) {
    return failure(state, "factory_line_reservation_locked", "Fronta obsahuje rezervaci podle předchozího receptu a musí se nejdřív dokončit nebo zrušit.");
  }
  const queuedLine = {
    ...line,
    queuedAmount: line.queuedAmount + quantity,
    reservedCleanCash: line.reservedCleanCash + cleanCost,
    reservedResourceCosts: addCosts(line.reservedResourceCosts, inputCosts),
    unitCleanCashCost: recipe.cleanCashCostPerUnit,
    unitResourceCosts: normalizeResourceCosts(recipe.inputCosts),
    version: line.version + 1
  };
  const nextLine = startFactoryLine(state, queuedLine, building, recipe, state.root.tick, context);
  const nextBuilding = {
    ...building,
    ownerPlayerId: player.id,
    productionLines: { ...building.productionLines, [recipe.outputResourceKey]: nextLine },
    version: building.version + 1
  };
  const nextResources: ResourceState = {
    ...resources,
    balances: debitCosts({ ...resources.balances, cash: Math.max(0, Number(resources.balances.cash || 0)) - cleanCost }, inputCosts),
    lastUpdatedTick: state.root.tick,
    version: resources.version + (stored ? 1 : 0)
  };
  return {
    nextState: {
      ...state,
      buildingsById: { ...state.buildingsById, [building.id]: nextBuilding },
      resourceStatesById: { ...state.resourceStatesById, [nextResources.id]: nextResources }
    },
    events: [createEvent(CORE_EVENT_TYPES.itemProcessingStarted, {
      playerId: player.id,
      districtId: building.districtId,
      buildingId: building.id,
      recipeId: recipe.outputResourceKey,
      outputResourceKey: recipe.outputResourceKey,
      outputAmount: 1,
      completesAtTick: nextLine.activeCompletesAtTick
    })],
    errors: []
  };
};

export const handleCancelFactoryProduction = (
  state: CoreGameState,
  command: FactoryLineCommand,
  context: GameCoreContext
): FactoryHandlerResult => {
  const validation = validateFactoryTarget(state, command, context);
  if (validation.errors.length || !validation.building || !validation.recipe) return { nextState: state, events: [], errors: validation.errors };
  const { building, recipe } = validation;
  const line = getFactoryLine(building, command.payload.recipeId);
  const activeAmount = line.activeCompletesAtTick === null ? 0 : 1;
  const waitingAmount = Math.max(0, line.queuedAmount - activeAmount);
  if (!waitingAmount) return failure(state, "factory_no_waiting_items", "Ve frontě nejsou žádné čekající kusy k zrušení.");
  const player = state.playersById[command.playerId];
  if (!player) return failure(state, "factory_not_owned", "Hráč nevlastní cílovou Továrnu.");
  const stored = state.resourceStatesById[player.resourceStateId];
  const resources = stored
    ? { ...stored, balances: normalizeStorageBalances(stored.balances) }
    : createFactoryPlayerResourceState(player, state.root.tick);
  const refundCash = Math.min(line.reservedCleanCash, waitingAmount * line.unitCleanCashCost);
  const refundInputs = limitCosts(line.reservedResourceCosts, scaleCosts(normalizeResourceCosts(line.unitResourceCosts), waitingAmount));
  const nextLine = {
    ...line,
    queuedAmount: activeAmount,
    reservedCleanCash: Math.max(0, line.reservedCleanCash - refundCash),
    reservedResourceCosts: subtractCosts(line.reservedResourceCosts, refundInputs),
    version: line.version + 1
  };
  const nextBuilding = { ...building, productionLines: { ...building.productionLines, [recipe.outputResourceKey]: nextLine }, version: building.version + 1 };
  const nextResources: ResourceState = {
    ...resources,
    balances: creditCosts({ ...resources.balances, cash: Math.max(0, Number(resources.balances.cash || 0)) + refundCash }, refundInputs),
    lastUpdatedTick: state.root.tick,
    version: resources.version + (stored ? 1 : 0)
  };
  return {
    nextState: {
      ...state,
      buildingsById: { ...state.buildingsById, [building.id]: nextBuilding },
      resourceStatesById: { ...state.resourceStatesById, [nextResources.id]: nextResources }
    },
    events: [],
    errors: []
  };
};

export const collectFactoryProduction = (
  state: CoreGameState,
  command: FactoryLineCommand,
  context: GameCoreContext
): FactoryHandlerResult => {
  const validation = validateFactoryTarget(state, command, context);
  if (validation.errors.length || !validation.building || !validation.recipe) return { nextState: state, events: [], errors: validation.errors };
  const { building, recipe } = validation;
  const output = getFactoryBuildingResourceState(state, building);
  const producedAmount = Math.max(0, Number(output.balances[recipe.outputResourceKey] || 0));
  if (!producedAmount) return failure(state, "production_empty", recipe.label + " ještě není připravený k vybrání.");
  const player = state.playersById[command.playerId];
  if (!player) return failure(state, "factory_not_owned", "Hráč nevlastní cílovou Továrnu.");
  const stored = state.resourceStatesById[player.resourceStateId];
  const resources = stored
    ? { ...stored, balances: normalizeStorageBalances(stored.balances) }
    : createFactoryPlayerResourceState(player, state.root.tick);
  const accepted = context.config.balance.warehouse
    ? calculateReceivableResourceAmount(state, player.id, recipe.outputResourceKey, producedAmount, context.config.balance.warehouse)
    : producedAmount;
  if (!accepted) return failure(state, "storage_capacity_full", "Sklad je pro tuto položku plný.");
  const nextOutput: ResourceState = {
    ...output,
    balances: { ...output.balances, [recipe.outputResourceKey]: producedAmount - accepted },
    lastUpdatedTick: state.root.tick,
    version: output.version + 1
  };
  const nextResources: ResourceState = {
    ...resources,
    balances: { ...resources.balances, [recipe.outputResourceKey]: Math.max(0, Number(resources.balances[recipe.outputResourceKey] || 0)) + accepted },
    lastUpdatedTick: state.root.tick,
    version: resources.version + (stored ? 1 : 0)
  };
  const resumed = resumeFactoryLines({ ...state, resourceStatesById: { ...state.resourceStatesById, [nextOutput.id]: nextOutput } }, building, context);
  return {
    nextState: {
      ...state,
      buildingsById: { ...state.buildingsById, [building.id]: resumed },
      resourceStatesById: { ...state.resourceStatesById, [nextOutput.id]: nextOutput, [nextResources.id]: nextResources }
    },
    events: [createEvent(CORE_EVENT_TYPES.productionCollected, {
      playerId: player.id, districtId: building.districtId, buildingId: building.id, resourceKey: recipe.outputResourceKey, amount: accepted
    })],
    errors: []
  };
};

export const collectAllFactoryProduction = (
  state: CoreGameState,
  command: { playerId: string; payload: { districtId: string; buildingId: string } },
  context: GameCoreContext
): FactoryHandlerResult => {
  let nextState = state;
  let events: CoreEvent[] = [];
  let collected = false;
  let firstError: FactoryHandlerResult["errors"][number] | null = null;
  for (const recipeId of ["metal-parts", "tech-core", "combat-module"]) {
    const result = collectFactoryProduction(nextState, {
      playerId: command.playerId,
      payload: { ...command.payload, recipeId }
    }, context);
    if (result.errors.length) {
      firstError ??= result.errors[0];
      continue;
    }
    nextState = result.nextState;
    events = [...events, ...result.events];
    collected = true;
  }
  return collected
    ? { nextState, events, errors: [] }
    : { nextState: state, events: [], errors: firstError ? [firstError] : [] };
};

export const resumeFactoryLines = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  context: GameCoreContext
) => {
  const factory = context.config.balance.factory;
  if (!factory) return building;
  let lines = building.productionLines ?? {};
  let changed = false;
  for (const [recipeId, recipe] of Object.entries(factory.recipes)) {
    const line = getFactoryLine({ ...building, productionLines: lines }, recipeId);
    if (line.queuedAmount <= 0 || line.activeCompletesAtTick !== null || getFactoryProducedAmount(state, building, recipe.outputResourceKey) >= recipe.localOutputCap) continue;
    lines = { ...lines, [recipeId]: startFactoryLine(state, line, building, recipe, state.root.tick, context) };
    changed = true;
  }
  return changed ? { ...building, productionLines: lines, version: building.version + 1 } : building;
};
