import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "@empire/game-core";
import {
  BUILDING_IDS,
  PLAYER_RESOURCE_ID,
  createCancelCommand,
  createCollectCommand,
  createCraftCommand,
  createProductionChainState,
  getBuildingOutput,
  getPlayerBalance
} from "./simulation-state";
const context = { config: resolveModeConfig("free") };

export interface ProductionChainSimulationStep {
  buildingTypeId: keyof typeof BUILDING_IDS;
  recipeId: string;
  quantity: number;
  startedAtTick: number;
  completedAtTick: number;
  ticksElapsed: number;
  maxCompletedInSingleTick: number;
  collectedAmount: number;
}

export interface ProductionChainSimulationReport {
  deterministicScenario: "pharmacy-lab-factory-armory";
  passed: boolean;
  steps: ProductionChainSimulationStep[];
  finalBalances: Record<string, number>;
  reservationAudit: {
    factoryStartAccepted: boolean;
    conflictingArmoryError: string | null;
    metalPartsAfterFactoryReservation: number;
    metalPartsAfterWaitingRefund: number;
    cleanCashAfterWaitingRefund: number;
    duplicateCancelError: string | null;
  };
  invariants: {
    allCommandsAccepted: boolean;
    onePieceCompletion: boolean;
    finalPistolCollected: boolean;
    noNegativeBalances: boolean;
    reservationConflictRejected: boolean;
    waitingRefundExact: boolean;
    duplicateRefundBlocked: boolean;
  };
}

export const runProductionChainSimulation = (): ProductionChainSimulationReport => {
  let state = createProductionChainState({ cash: 10_000 });
  let commandSequence = 0;
  const steps: ProductionChainSimulationStep[] = [];

  const runRecipe = (
    buildingTypeId: keyof typeof BUILDING_IDS,
    recipeId: string,
    quantity: number
  ): void => {
    const buildingId = BUILDING_IDS[buildingTypeId];
    const outputBefore = getBuildingOutput(state, buildingId, recipeId);
    const startedAtTick = state.root.tick;
    const start = applyCommand(state, createCraftCommand(++commandSequence, buildingId, recipeId, quantity), context);
    requireNoErrors(start.errors, `start ${buildingTypeId}/${recipeId}`);
    state = start.nextState;

    let maxCompletedInSingleTick = 0;
    let ticksElapsed = 0;
    while (getBuildingOutput(state, buildingId, recipeId) < outputBefore + quantity) {
      const beforeTick = getBuildingOutput(state, buildingId, recipeId);
      state = runTick(state, context).nextState;
      const afterTick = getBuildingOutput(state, buildingId, recipeId);
      maxCompletedInSingleTick = Math.max(maxCompletedInSingleTick, afterTick - beforeTick);
      ticksElapsed += 1;
      if (ticksElapsed > 10_000) {
        throw new Error(`Production chain timed out at ${buildingTypeId}/${recipeId}.`);
      }
    }

    const playerBeforeCollect = getPlayerBalance(state, recipeId);
    const collect = applyCommand(state, createCollectCommand(++commandSequence, buildingId, recipeId), context);
    requireNoErrors(collect.errors, `collect ${buildingTypeId}/${recipeId}`);
    state = collect.nextState;
    steps.push({
      buildingTypeId,
      recipeId,
      quantity,
      startedAtTick,
      completedAtTick: state.root.tick,
      ticksElapsed,
      maxCompletedInSingleTick,
      collectedAmount: getPlayerBalance(state, recipeId) - playerBeforeCollect
    });
  };

  runRecipe("pharmacy", "chemicals", 2);
  runRecipe("drug_lab", "neon-dust", 1);
  runRecipe("factory", "metal-parts", 7);
  runRecipe("factory", "tech-core", 1);
  runRecipe("armory", "pistol", 1);

  const finalBalances = { ...state.resourceStatesById[PLAYER_RESOURCE_ID]!.balances };
  const reservationAudit = runReservationAudit();
  const invariants = {
    allCommandsAccepted: steps.length === 5 && steps.every((step) => step.collectedAmount === step.quantity),
    onePieceCompletion: steps.every((step) => step.maxCompletedInSingleTick === 1),
    finalPistolCollected: finalBalances.pistol === 1,
    noNegativeBalances: Object.values(finalBalances).every((amount) => amount >= 0),
    reservationConflictRejected: reservationAudit.conflictingArmoryError === "armory_missing_inputs",
    waitingRefundExact: reservationAudit.metalPartsAfterWaitingRefund === 5
      && reservationAudit.cleanCashAfterWaitingRefund === 900,
    duplicateRefundBlocked: reservationAudit.duplicateCancelError === "factory_no_waiting_items"
  };

  return {
    deterministicScenario: "pharmacy-lab-factory-armory",
    passed: Object.values(invariants).every(Boolean),
    steps,
    finalBalances,
    reservationAudit,
    invariants
  };
};

const runReservationAudit = (): ProductionChainSimulationReport["reservationAudit"] => {
  let state = createProductionChainState({ cash: 1_800, "metal-parts": 9, "tech-core": 1 });
  const factoryStart = applyCommand(state, createCraftCommand(100, BUILDING_IDS.factory, "tech-core", 2), context);
  state = factoryStart.nextState;
  const metalPartsAfterFactoryReservation = getPlayerBalance(state, "metal-parts");
  const armoryStart = applyCommand(state, createCraftCommand(101, BUILDING_IDS.armory, "pistol", 1), context);
  const cancel = createCancelCommand(102, BUILDING_IDS.factory, "tech-core");
  const canceled = applyCommand(state, cancel, context);
  const duplicate = applyCommand(canceled.nextState, cancel, context);

  return {
    factoryStartAccepted: factoryStart.errors.length === 0,
    conflictingArmoryError: armoryStart.errors[0]?.code ?? null,
    metalPartsAfterFactoryReservation,
    metalPartsAfterWaitingRefund: getPlayerBalance(canceled.nextState, "metal-parts"),
    cleanCashAfterWaitingRefund: getPlayerBalance(canceled.nextState, "cash"),
    duplicateCancelError: duplicate.errors[0]?.code ?? null
  };
};

const requireNoErrors = (errors: Array<{ code: string; message: string }>, operation: string): void => {
  if (errors.length > 0) {
    throw new Error(`${operation} failed: ${errors.map((error) => error.code).join(", ")}`);
  }
};
