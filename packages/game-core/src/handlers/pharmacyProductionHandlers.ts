import type {
  CancelPharmacyProductionCommand,
  CraftItemCommand,
  ResourceState
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { createEvent, CORE_EVENT_TYPES } from "../events";
import type { GameCoreContext } from "../engine/context";
import { calculateReceivableResourceAmount, normalizeStorageBalances } from "./warehouseBuilding";
import {
  getPharmacyBuildingResourceState,
  getPharmacyLine,
  getPharmacyProducedAmount,
  getPharmacyRecipe,
  PHARMACY_BUILDING_TYPE_ID,
  startPharmacyLine
} from "./pharmacyProductionShared";

type HandlerResult = { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] };

export const handlePharmacyProductionStart = (
  state: CoreGameState,
  command: CraftItemCommand,
  context: GameCoreContext
): HandlerResult => {
  const validation = validatePharmacyTarget(state, command, context);
  if (validation.errors.length > 0 || !validation.building || !validation.recipe) {
    return { nextState: state, events: [], errors: validation.errors };
  }
  const quantity = Number(command.payload.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return failure(state, "pharmacy_invalid_quantity", "Množství výroby musí být kladné celé číslo.");
  }

  const { building, recipe } = validation;
  const line = getPharmacyLine(building, command.payload.recipeId);
  const producedAmount = getPharmacyProducedAmount(state, building, recipe.outputResourceKey);
  if (producedAmount >= recipe.localOutputCap) {
    return failure(state, "pharmacy_output_full", "Lokální zásoba Lékárny je plná.");
  }
  if (line.queuedAmount + quantity > recipe.queueCap) {
    return failure(state, "pharmacy_queue_full", "Fronta této výrobní linky je plná.");
  }

  const player = state.playersById[command.playerId];
  if (!player) return failure(state, "pharmacy_not_owned", "Hráč nevlastní cílovou Lékárnu.");
  const storedPlayerResourceState = state.resourceStatesById[player.resourceStateId];
  const playerResourceState = storedPlayerResourceState
    ? { ...storedPlayerResourceState, balances: normalizeStorageBalances(storedPlayerResourceState.balances) }
    : createPlayerResourceState(player, state.root.tick);
  const totalCost = quantity * recipe.cleanCashCostPerUnit;
  const cleanCash = Math.max(0, Number(playerResourceState.balances.cash || 0));
  if (cleanCash < totalCost) {
    return failure(state, "pharmacy_insufficient_clean_cash", "Na spuštění výroby nemáš dost clean cash.");
  }

  const queuedLine = {
    ...line,
    queuedAmount: line.queuedAmount + quantity,
    reservedCleanCash: line.reservedCleanCash + totalCost,
    unitCleanCashCost: recipe.cleanCashCostPerUnit,
    version: line.version + 1
  };
  const nextLine = startPharmacyLine(queuedLine, building, recipe, state.root.tick, context);
  const nextBuilding = {
    ...building,
    productionLines: {
      ...building.productionLines,
      [recipe.outputResourceKey]: nextLine
    },
    version: building.version + 1
  };
  const nextPlayerResourceState: ResourceState = {
    ...playerResourceState,
    balances: { ...playerResourceState.balances, cash: cleanCash - totalCost },
    lastUpdatedTick: state.root.tick,
    version: playerResourceState.version + (storedPlayerResourceState ? 1 : 0)
  };

  return {
    nextState: {
      ...state,
      buildingsById: { ...state.buildingsById, [building.id]: nextBuilding },
      resourceStatesById: { ...state.resourceStatesById, [nextPlayerResourceState.id]: nextPlayerResourceState }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.itemProcessingStarted, {
        playerId: command.playerId,
        districtId: command.payload.districtId,
        buildingId: building.id,
        recipeId: recipe.outputResourceKey,
        completesAtTick: nextLine.activeCompletesAtTick
      })
    ],
    errors: []
  };
};

export const handleCancelPharmacyProduction = (
  state: CoreGameState,
  command: CancelPharmacyProductionCommand,
  context: GameCoreContext
): HandlerResult => {
  const validation = validatePharmacyTarget(state, command, context);
  if (validation.errors.length > 0 || !validation.building || !validation.recipe) {
    return { nextState: state, events: [], errors: validation.errors };
  }
  const { building, recipe } = validation;
  const line = getPharmacyLine(building, command.payload.recipeId);
  const activeAmount = line.activeCompletesAtTick === null ? 0 : 1;
  const waitingAmount = Math.max(0, line.queuedAmount - activeAmount);
  if (waitingAmount <= 0) {
    return failure(state, "pharmacy_no_waiting_items", "Ve frontě nejsou žádné čekající kusy k zrušení.");
  }

  const player = state.playersById[command.playerId];
  if (!player) return failure(state, "pharmacy_not_owned", "Hráč nevlastní cílovou Lékárnu.");
  const storedPlayerResourceState = state.resourceStatesById[player.resourceStateId];
  const playerResourceState = storedPlayerResourceState
    ? { ...storedPlayerResourceState, balances: normalizeStorageBalances(storedPlayerResourceState.balances) }
    : createPlayerResourceState(player, state.root.tick);
  const refundAmount = Math.min(line.reservedCleanCash, waitingAmount * line.unitCleanCashCost);
  const nextLine = {
    ...line,
    queuedAmount: activeAmount,
    reservedCleanCash: Math.max(0, line.reservedCleanCash - refundAmount),
    version: line.version + 1
  };
  const nextBuilding = {
    ...building,
    productionLines: { ...building.productionLines, [recipe.outputResourceKey]: nextLine },
    version: building.version + 1
  };
  const nextPlayerResourceState: ResourceState = {
    ...playerResourceState,
    balances: {
      ...playerResourceState.balances,
      cash: Math.max(0, Number(playerResourceState.balances.cash || 0)) + refundAmount
    },
    lastUpdatedTick: state.root.tick,
    version: playerResourceState.version + (storedPlayerResourceState ? 1 : 0)
  };
  return {
    nextState: {
      ...state,
      buildingsById: { ...state.buildingsById, [building.id]: nextBuilding },
      resourceStatesById: { ...state.resourceStatesById, [nextPlayerResourceState.id]: nextPlayerResourceState }
    },
    events: [],
    errors: []
  };
};

export const collectPharmacyProduction = (
  state: CoreGameState,
  command: { playerId: string; payload: { districtId: string; buildingId: string; recipeId: string } },
  context: GameCoreContext
): HandlerResult => {
  const validation = validatePharmacyTarget(state, command, context);
  if (validation.errors.length > 0 || !validation.building || !validation.recipe) {
    return { nextState: state, events: [], errors: validation.errors };
  }
  const { building, recipe } = validation;
  const resourceState = getPharmacyBuildingResourceState(state, building);
  const producedAmount = Math.max(0, Number(resourceState.balances[recipe.outputResourceKey] || 0));
  if (producedAmount <= 0) return failure(state, "production_empty", recipe.label + " ještě není připravený k vybrání.");

  const player = state.playersById[command.playerId];
  if (!player) return failure(state, "pharmacy_not_owned", "Hráč nevlastní cílovou Lékárnu.");
  const storedPlayerResourceState = state.resourceStatesById[player.resourceStateId];
  const playerResourceState = storedPlayerResourceState
    ? { ...storedPlayerResourceState, balances: normalizeStorageBalances(storedPlayerResourceState.balances) }
    : createPlayerResourceState(player, state.root.tick);
  const acceptedAmount = context.config.balance.warehouse
    ? calculateReceivableResourceAmount(state, player.id, recipe.outputResourceKey, producedAmount, context.config.balance.warehouse)
    : producedAmount;
  if (acceptedAmount <= 0) return failure(state, "storage_capacity_full", "Sklad je pro tuto položku plný.");

  const nextResourceState: ResourceState = {
    ...resourceState,
    balances: { ...resourceState.balances, [recipe.outputResourceKey]: producedAmount - acceptedAmount },
    lastUpdatedTick: state.root.tick,
    version: resourceState.version + 1
  };
  const currentPlayerAmount = Math.max(0, Number(playerResourceState.balances[recipe.outputResourceKey] || 0));
  const nextPlayerResourceState: ResourceState = {
    ...playerResourceState,
    balances: { ...playerResourceState.balances, [recipe.outputResourceKey]: currentPlayerAmount + acceptedAmount },
    lastUpdatedTick: state.root.tick,
    version: playerResourceState.version + (storedPlayerResourceState ? 1 : 0)
  };
  const resumedBuilding = resumePharmacyLines(
    { ...state, resourceStatesById: { ...state.resourceStatesById, [nextResourceState.id]: nextResourceState } },
    building,
    context
  );
  return {
    nextState: {
      ...state,
      buildingsById: { ...state.buildingsById, [building.id]: resumedBuilding },
      resourceStatesById: {
        ...state.resourceStatesById,
        [nextResourceState.id]: nextResourceState,
        [nextPlayerResourceState.id]: nextPlayerResourceState
      }
    },
    events: [createEvent(CORE_EVENT_TYPES.productionCollected, {
      playerId: player.id, districtId: building.districtId, buildingId: building.id,
      resourceKey: recipe.outputResourceKey, amount: acceptedAmount
    })],
    errors: []
  };
};

export const resumePharmacyLines = (state: CoreGameState, building: CoreGameState["buildingsById"][string], context: GameCoreContext) => {
  const pharmacy = context.config.balance.pharmacy;
  if (!pharmacy) return building;
  let lines = building.productionLines ?? {};
  let changed = false;
  for (const [recipeId, recipe] of Object.entries(pharmacy.recipes)) {
    const line = getPharmacyLine({ ...building, productionLines: lines }, recipeId);
    if (line.queuedAmount <= 0 || line.activeCompletesAtTick !== null || getPharmacyProducedAmount(state, building, recipe.outputResourceKey) >= recipe.localOutputCap) continue;
    lines = { ...lines, [recipeId]: startPharmacyLine(line, building, recipe, state.root.tick, context) };
    changed = true;
  }
  return changed ? { ...building, productionLines: lines, version: building.version + 1 } : building;
};
const validatePharmacyTarget = (state: CoreGameState, command: { playerId: string; payload: { districtId: string; buildingId: string; recipeId: string } }, context: GameCoreContext) => {
  const building = state.buildingsById[command.payload.buildingId];
  if (!building || building.buildingTypeId !== PHARMACY_BUILDING_TYPE_ID) return { building: null, recipe: null, errors: [{ code: "pharmacy_line_not_found", message: "Cílová výrobní linka Lékárny neexistuje." }] satisfies CoreError[] };
  const district = state.districtsById[command.payload.districtId];
  if (!district || district.id !== building.districtId) return { building: null, recipe: null, errors: [{ code: "district_not_found", message: "Cílový district neexistuje." }] satisfies CoreError[] };
  if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) return { building: null, recipe: null, errors: [{ code: "pharmacy_not_owned", message: "Hráč nevlastní cílovou Lékárnu." }] satisfies CoreError[] };
  if (building.status !== "active") return { building: null, recipe: null, errors: [{ code: "pharmacy_not_active", message: "Lékárna musí být aktivní." }] satisfies CoreError[] };
  const recipe = getPharmacyRecipe(context.config.balance.pharmacy, command.payload.recipeId);
  return recipe
    ? { building, recipe, errors: [] as CoreError[] }
    : { building: null, recipe: null, errors: [{ code: "pharmacy_line_not_found", message: "Požadovaná výrobní linka neexistuje." }] satisfies CoreError[] };
};

const createPlayerResourceState = (player: CoreGameState["playersById"][string], tick: number): ResourceState => ({
  id: player.resourceStateId, ownerType: "player", ownerId: player.id, balances: {}, incomeModifiers: {}, lastUpdatedTick: tick, version: 1
});

const failure = (state: CoreGameState, code: string, message: string): HandlerResult => ({
  nextState: state, events: [], errors: [{ code, message }]
});
