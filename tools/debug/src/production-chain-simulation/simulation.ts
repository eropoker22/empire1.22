import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "@empire/game-core";
import {
  BUILDING_IDS,
  PLAYER_RESOURCE_ID,
  createCollectCommand,
  createCraftCommand,
  createProductionChainState,
  getPlayerBalance
} from "./simulation-state";

const context = { config: resolveModeConfig("free") };

export interface ProductionChainSimulationStep {
  buildingTypeId: keyof typeof BUILDING_IDS;
  recipeId: string;
  quantity: number;
  submittedAtTick: number;
  resolvedAtTick: number;
  ticksElapsed: number;
  outputBefore: number;
  outputAfter: number;
  producedAmount: number;
}

export interface ProductionChainSimulationReport {
  deterministicScenario: "pharmacy-lab-factory-armory";
  passed: boolean;
  steps: ProductionChainSimulationStep[];
  finalBalances: Record<string, number>;
  atomicityAudit: {
    factoryCraftAccepted: boolean;
    conflictingArmoryError: string | null;
    metalPartsAfterFactoryCraft: number;
    cleanCashAfterFactoryCraft: number;
    techCoreAfterFactoryCraft: number;
    rejectedArmoryPreservedBalances: boolean;
    legacyProductionJobsRemaining: number;
  };
  invariants: {
    allCommandsAccepted: boolean;
    allResultsDeferred: boolean;
    exactOutputCredits: boolean;
    finalPistolProduced: boolean;
    noNegativeBalances: boolean;
    conflictingCraftRejected: boolean;
    rejectedCraftAtomic: boolean;
    noLegacyProductionJobs: boolean;
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
    const outputBefore = getPlayerBalance(state, recipeId);
    const submittedAtTick = state.root.tick;
    const started = applyCommand(
      state,
      createCraftCommand(++commandSequence, buildingId, recipeId, quantity),
      context
    );
    requireNoErrors(started.errors, `produce ${buildingTypeId}/${recipeId}`);
    state = advanceProductionUntilIdle(started.nextState, buildingId, recipeId);
    const collected = applyCommand(
      state,
      createCollectCommand(++commandSequence, buildingId, recipeId),
      context
    );
    requireNoErrors(collected.errors, `collect ${buildingTypeId}/${recipeId}`);
    state = collected.nextState;
    const outputAfter = getPlayerBalance(state, recipeId);
    steps.push({
      buildingTypeId,
      recipeId,
      quantity,
      submittedAtTick,
      resolvedAtTick: state.root.tick,
      ticksElapsed: state.root.tick - submittedAtTick,
      outputBefore,
      outputAfter,
      producedAmount: outputAfter - outputBefore
    });
  };

  runRecipe("pharmacy", "chemicals", 2);
  runRecipe("drug_lab", "neon-dust", 1);
  runRecipe("factory", "metal-parts", 7);
  runRecipe("factory", "tech-core", 1);
  runRecipe("armory", "pistol", 1);

  const finalBalances = { ...state.resourceStatesById[PLAYER_RESOURCE_ID]!.balances };
  const atomicityAudit = runAtomicityAudit();
  const invariants = {
    allCommandsAccepted: steps.length === 5,
    allResultsDeferred: steps.every((step) => step.ticksElapsed > 0),
    exactOutputCredits: steps.every((step) => step.producedAmount === step.quantity),
    finalPistolProduced: finalBalances.pistol === 1,
    noNegativeBalances: Object.values(finalBalances).every((amount) => amount >= 0),
    conflictingCraftRejected: atomicityAudit.conflictingArmoryError === "armory_missing_inputs",
    rejectedCraftAtomic: atomicityAudit.rejectedArmoryPreservedBalances,
    noLegacyProductionJobs: atomicityAudit.legacyProductionJobsRemaining === 0
  };

  return {
    deterministicScenario: "pharmacy-lab-factory-armory",
    passed: Object.values(invariants).every(Boolean),
    steps,
    finalBalances,
    atomicityAudit,
    invariants
  };
};

const runAtomicityAudit = (): ProductionChainSimulationReport["atomicityAudit"] => {
  let state = createProductionChainState({ cash: 1_800, "metal-parts": 9, "tech-core": 1 });
  const factoryCraft = applyCommand(
    state,
    createCraftCommand(100, BUILDING_IDS.factory, "tech-core", 2),
    context
  );
  state = factoryCraft.nextState;
  const balancesBeforeRejectedArmory = { ...state.resourceStatesById[PLAYER_RESOURCE_ID]!.balances };
  const armoryCraft = applyCommand(
    state,
    createCraftCommand(101, BUILDING_IDS.armory, "pistol", 1),
    context
  );
  const balancesAfterRejectedArmory = armoryCraft.nextState.resourceStatesById[PLAYER_RESOURCE_ID]!.balances;
  const legacyProductionJobsRemaining = Object.values(armoryCraft.nextState.buildingsById)
    .reduce((total, building) => total + (building.processing ? 1 : 0), 0);

  return {
    factoryCraftAccepted: factoryCraft.errors.length === 0,
    conflictingArmoryError: armoryCraft.errors[0]?.code ?? null,
    metalPartsAfterFactoryCraft: getPlayerBalance(state, "metal-parts"),
    cleanCashAfterFactoryCraft: getPlayerBalance(state, "cash"),
    techCoreAfterFactoryCraft: getPlayerBalance(state, "tech-core"),
    rejectedArmoryPreservedBalances:
      JSON.stringify(balancesAfterRejectedArmory) === JSON.stringify(balancesBeforeRejectedArmory),
    legacyProductionJobsRemaining
  };
};

const advanceProductionUntilIdle = (
  initialState: ReturnType<typeof createProductionChainState>,
  buildingId: string,
  recipeId: string
): ReturnType<typeof createProductionChainState> => {
  let state = initialState;
  for (let iteration = 0; iteration < 1_000; iteration += 1) {
    const line = state.buildingsById[buildingId]?.productionLines?.[recipeId];
    if (!line || line.queuedAmount <= 0) return state;
    const dueTick = line.activeCompletesAtTick;
    if (!dueTick) throw new Error(`Production ${buildingId}/${recipeId} has no active timer.`);
    while (state.root.tick < dueTick) state = runTick(state, context).nextState;
  }
  throw new Error(`Production ${buildingId}/${recipeId} did not become idle.`);
};

const requireNoErrors = (errors: Array<{ code: string; message: string }>, operation: string): void => {
  if (errors.length > 0) {
    throw new Error(`${operation} failed: ${errors.map((error) => error.code).join(", ")}`);
  }
};
