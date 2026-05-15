import { type GameCoreContext } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { executeBotActions } from "./actions";
import { applyIncomeCatchup, moveStateToTickBeforeNextRun, runPacingTick } from "./pacingTick";
import {
  captureSnapshot,
  createPacingVerdict,
  updateMilestones
} from "./report";
import { createFreeModePacingState } from "./state";
import { applyPacingVariantToConfig, FREE_MODE_PACING_VARIANTS, resolveFreeModePacingVariant } from "./variants";
import { createFactionWinRate } from "./factionMetrics";
import { recordEliminationTimelineEntries } from "./timeline";
import {
  createInitialPacingMetrics,
  type FreeModePacingOptions,
  type PacingVariantSuiteResult,
  type PacingSimulationResult
} from "./types";

const DEFAULT_CHECKPOINT_HOURS = [24, 48, 72, 96];
const DEFAULT_BOT_COUNT = 20;
const DEFAULT_DISTRICT_COUNT = 100;
const DEFAULT_TICK_STRIDE = 720;

export const runFreeModePacingSimulation = (
  options: FreeModePacingOptions = {}
): PacingSimulationResult => {
  const variant = options.variant ?? resolveFreeModePacingVariant(options.variantName ?? "baseline");
  const config = applyPacingVariantToConfig(resolveModeConfig("free"), variant);
  const context: GameCoreContext = { config };
  const ticksPerHour = Math.round((60 * 60 * 1000) / config.tickRateMs);
  const checkpointHours = [...(options.checkpointHours ?? DEFAULT_CHECKPOINT_HOURS)].sort((a, b) => a - b);
  const maxHours = options.maxHours ?? Math.max(...checkpointHours);
  const checkpointTicks = new Map(checkpointHours.map((hour) => [hour * ticksPerHour, hour]));
  const tickStride = Math.max(1, Math.floor(options.tickStride ?? DEFAULT_TICK_STRIDE));
  const metrics = createInitialPacingMetrics();
  let state = createFreeModePacingState({
    config,
    seed: options.seed ?? "free-mode-pacing:v1",
    botCount: options.botCount ?? DEFAULT_BOT_COUNT,
    districtCount: options.districtCount ?? DEFAULT_DISTRICT_COUNT
  });
  const snapshots = [];
  const maxTick = maxHours * ticksPerHour;

  for (let tick = tickStride; tick <= maxTick; tick += tickStride) {
    const previousTick = Math.max(0, tick - tickStride);
    state = moveStateToTickBeforeNextRun(state, tick);
    const tickResult = runPacingTick(state, context);
    state = applyIncomeCatchup(tickResult.nextState, context, tickStride - 1);
    recordEliminationTimelineEntries(state, config, tickResult.events, metrics.eliminationTimeline);
    updateMilestones(state, config, metrics);

    if (!state.matchResult) {
      executeBotActions(state, context, metrics, state.root.tick, previousTick);
      updateMilestones(state, config, metrics);
    }

    const checkpointHour = checkpointTicks.get(tick);
    if (checkpointHour !== undefined) {
      snapshots.push(captureSnapshot(state, config, metrics, checkpointHour, variant.variantName));
    }

    if (state.matchResult && checkpointHour === undefined && tick >= maxTick) {
      snapshots.push(captureSnapshot(state, config, metrics, Math.round(tick / ticksPerHour), variant.variantName));
    }
  }

  const result: PacingSimulationResult = {
    variantName: variant.variantName,
    config: {
      tickRateMs: config.tickRateMs,
      ticksPerHour,
      tickStride,
      dayLengthTicks: config.balance.dayLengthTicks,
      nightLengthTicks: config.balance.nightLengthTicks,
      minimumVictoryTicks: config.balance.minimumVictoryTicks ?? 0,
      controlHoldTicks: config.balance.districtControlHoldTicks ?? 0,
      hardTimeoutTicks: config.balance.hardTimeoutTicks ?? Math.ceil(config.technical.gameDurationMs / config.tickRateMs),
      victoryThreshold: config.balance.districtControlVictoryThreshold ?? 1,
      allowDurationVictoryFallback: config.balance.allowDurationVictoryFallback ?? true
    },
    finalState: state,
    snapshots,
    eliminationTimeline: metrics.eliminationTimeline,
    milestones: {
      first25: metrics.first25,
      first50: metrics.first50,
      first75: metrics.first75
    },
    verdict: ""
  };
  result.verdict = createPacingVerdict(result);
  return result;
};

export const runFreeModePacingVariantSuite = (
  options: FreeModePacingOptions = {}
): PacingVariantSuiteResult => {
  const variants = options.variantName || options.variant
    ? [options.variant ?? resolveFreeModePacingVariant(options.variantName ?? "baseline")]
    : FREE_MODE_PACING_VARIANTS;

  const results = variants.map((variant) =>
    runFreeModePacingSimulation({
      ...options,
      variant,
      variantName: undefined
    })
  );

  return {
    results,
    factionWinRate: createFactionWinRate(results.map((result) => result.finalState))
  };
};
