import type { CancelDrugLabProductionCommand, CraftItemCommand, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { createEvent, CORE_EVENT_TYPES } from "../events";
import type { GameCoreContext } from "../engine/context";
import { calculateReceivableResourceAmount, normalizeStorageBalances } from "./warehouseBuilding";
import { normalizeResourceCosts } from "./productionLineShared";
import { addCosts, creditCosts, debitCosts, equalCosts, hasRequiredResources, limitCosts, scaleCosts, subtractCosts } from "./productionLineCosts";
import { createPlayerResourceState, drugLabFailure as failure, type DrugLabHandlerResult, validateDrugLabTarget } from "./drugLabProductionSupport";
import { getDrugLabBuildingResourceState, getDrugLabLine, getDrugLabProducedAmount, startDrugLabLine } from "./drugLabProductionShared";
import { executeInstantProduction } from "./instantProduction";

export const handleDrugLabProductionStart = (
  state: CoreGameState,
  command: CraftItemCommand,
  context: GameCoreContext
): DrugLabHandlerResult => {
  const validation = validateDrugLabTarget(state, command, context);
  if (validation.errors.length > 0 || !validation.building || !validation.recipe) {
    return { nextState: state, events: [], errors: validation.errors };
  }
  const quantity = Number(command.payload.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return failure(state, "drug_lab_invalid_quantity", "Množství výroby musí být kladné celé číslo.");
  }

  const { building, recipe } = validation;
  return executeInstantProduction({
    state,
    context,
    playerId: command.playerId,
    buildingId: building.id,
    districtId: building.districtId,
    recipeId: command.payload.recipeId,
    quantity,
    issuedAt: command.issuedAt,
    recipe,
    errors: {
      playerMissing: { code: "drug_lab_not_owned", message: "Hráč nevlastní cílový Lab." },
      insufficientCash: { code: "drug_lab_insufficient_clean_cash", message: "Na výrobu nemáš dost clean cash." },
      missingInputs: { code: "drug_lab_missing_inputs", message: "Na výrobu nemáš dost materiálových vstupů." }
    }
  });
};

export const handleCancelDrugLabProduction = (
  state: CoreGameState,
  command: CancelDrugLabProductionCommand,
  context: GameCoreContext
): DrugLabHandlerResult => {
  const validation = validateDrugLabTarget(state, command, context);
  if (validation.errors.length > 0 || !validation.building || !validation.recipe) {
    return { nextState: state, events: [], errors: validation.errors };
  }
  const { building, recipe } = validation;
  const line = getDrugLabLine(building, command.payload.recipeId);
  const activeAmount = line.activeCompletesAtTick === null ? 0 : 1;
  const waitingAmount = Math.max(0, line.queuedAmount - activeAmount);
  if (waitingAmount <= 0) {
    return failure(state, "drug_lab_no_waiting_items", "Ve frontě nejsou žádné čekající kusy k zrušení.");
  }

  const player = state.playersById[command.playerId];
  if (!player) return failure(state, "drug_lab_not_owned", "Hráč nevlastní cílový Lab.");
  const stored = state.resourceStatesById[player.resourceStateId];
  const resourceState = stored
    ? { ...stored, balances: normalizeStorageBalances(stored.balances) }
    : createPlayerResourceState(player, state.root.tick);
  const refundCleanCash = Math.min(line.reservedCleanCash, waitingAmount * line.unitCleanCashCost);
  const refundInputs = limitCosts(
    line.reservedResourceCosts,
    scaleCosts(normalizeResourceCosts(line.unitResourceCosts), waitingAmount)
  );
  const nextLine = {
    ...line,
    queuedAmount: activeAmount,
    reservedCleanCash: Math.max(0, line.reservedCleanCash - refundCleanCash),
    reservedResourceCosts: subtractCosts(line.reservedResourceCosts, refundInputs),
    version: line.version + 1
  };
  const nextBuilding = {
    ...building,
    productionLines: { ...building.productionLines, [recipe.outputResourceKey]: nextLine },
    version: building.version + 1
  };
  const nextResourceState: ResourceState = {
    ...resourceState,
    balances: creditCosts(
      { ...resourceState.balances, cash: Math.max(0, Number(resourceState.balances.cash || 0)) + refundCleanCash },
      refundInputs
    ),
    lastUpdatedTick: state.root.tick,
    version: resourceState.version + (stored ? 1 : 0)
  };
  return {
    nextState: {
      ...state,
      buildingsById: { ...state.buildingsById, [building.id]: nextBuilding },
      resourceStatesById: { ...state.resourceStatesById, [nextResourceState.id]: nextResourceState }
    },
    events: [],
    errors: []
  };
};

export const collectDrugLabProduction = (
  state: CoreGameState,
  command: { playerId: string; payload: { districtId: string; buildingId: string; recipeId: string } },
  context: GameCoreContext
): DrugLabHandlerResult => {
  const validation = validateDrugLabTarget(state, command, context);
  if (validation.errors.length > 0 || !validation.building || !validation.recipe) {
    return { nextState: state, events: [], errors: validation.errors };
  }
  const { building, recipe } = validation;
  const buildingResourceState = getDrugLabBuildingResourceState(state, building);
  const producedAmount = Math.max(0, Number(buildingResourceState.balances[recipe.outputResourceKey] || 0));
  if (producedAmount <= 0) return failure(state, "production_empty", recipe.label + " ještě není připravený k vybrání.");
  const player = state.playersById[command.playerId];
  if (!player) return failure(state, "drug_lab_not_owned", "Hráč nevlastní cílový Lab.");
  const stored = state.resourceStatesById[player.resourceStateId];
  const playerResourceState = stored
    ? { ...stored, balances: normalizeStorageBalances(stored.balances) }
    : createPlayerResourceState(player, state.root.tick);
  const acceptedAmount = context.config.balance.warehouse
    ? calculateReceivableResourceAmount(state, player.id, recipe.outputResourceKey, producedAmount, context.config.balance.warehouse)
    : producedAmount;
  if (acceptedAmount <= 0) return failure(state, "storage_capacity_full", "Sklad je pro tuto položku plný.");

  const nextBuildingResourceState: ResourceState = {
    ...buildingResourceState,
    balances: { ...buildingResourceState.balances, [recipe.outputResourceKey]: producedAmount - acceptedAmount },
    lastUpdatedTick: state.root.tick,
    version: buildingResourceState.version + 1
  };
  const currentPlayerAmount = Math.max(0, Number(playerResourceState.balances[recipe.outputResourceKey] || 0));
  const nextPlayerResourceState: ResourceState = {
    ...playerResourceState,
    balances: { ...playerResourceState.balances, [recipe.outputResourceKey]: currentPlayerAmount + acceptedAmount },
    lastUpdatedTick: state.root.tick,
    version: playerResourceState.version + (stored ? 1 : 0)
  };
  const resumedBuilding = resumeDrugLabLines(
    { ...state, resourceStatesById: { ...state.resourceStatesById, [nextBuildingResourceState.id]: nextBuildingResourceState } },
    building,
    context
  );
  return {
    nextState: {
      ...state,
      buildingsById: { ...state.buildingsById, [building.id]: resumedBuilding },
      resourceStatesById: {
        ...state.resourceStatesById,
        [nextBuildingResourceState.id]: nextBuildingResourceState,
        [nextPlayerResourceState.id]: nextPlayerResourceState
      }
    },
    events: [createEvent(CORE_EVENT_TYPES.productionCollected, {
      playerId: player.id,
      districtId: building.districtId,
      buildingId: building.id,
      resourceKey: recipe.outputResourceKey,
      amount: acceptedAmount
    })],
    errors: []
  };
};

export const resumeDrugLabLines = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  context: GameCoreContext
) => {
  const drugLab = context.config.balance.drugLab;
  if (!drugLab) return building;
  let lines = building.productionLines ?? {};
  let changed = false;
  for (const [recipeId, recipe] of Object.entries(drugLab.recipes)) {
    const line = getDrugLabLine({ ...building, productionLines: lines }, recipeId);
    if (
      line.queuedAmount <= 0
      || line.activeCompletesAtTick !== null
      || getDrugLabProducedAmount(state, building, recipe.outputResourceKey) >= recipe.localOutputCap
    ) continue;
    lines = { ...lines, [recipeId]: startDrugLabLine(state, line, building, recipe, state.root.tick, context) };
    changed = true;
  }
  return changed ? { ...building, productionLines: lines, version: building.version + 1 } : building;
};
