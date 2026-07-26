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
import { aggregateFactionBalanceStats, createFactionBalanceStats } from "./factionBalanceStats";
import { createBehaviorProfileReport } from "./factionBotBehavior";
import { recordEliminationTimelineEntries } from "./timeline";
import {
  createInitialPacingMetrics,
  type FreeModePacingOptions,
  type PacingMultiSeedFactionReport,
  type PacingVariantSuiteResult,
  type PacingSimulationResult
} from "./types";
import { PLAYER_FACTION_IDS, type PlayerFactionId } from "@empire/shared-types";
import { ticksFromHours } from "../../../../packages/game-config/src/modes/free/free-mode-timing";

const DEFAULT_CHECKPOINT_HOURS = [24, 48, 72, 96];
const DEFAULT_BOT_COUNT = 20;
const DEFAULT_DISTRICT_COUNT = 100;
const DEFAULT_TICK_STRIDE = ticksFromHours(1);

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
    factionBalanceStats: createFactionBalanceStats(state, ticksPerHour, metrics.factionActionStats),
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

export const runFreeModePacingMultiSeedAudit = (
  options: FreeModePacingOptions = {}
): PacingMultiSeedFactionReport => {
  const seedCount = Math.max(1, Math.floor(options.seedCount ?? 20));
  const variant = options.variant ?? resolveFreeModePacingVariant(
    options.variantName ?? "elimination-8h-stop8-lower-catastrophe-faster-attacks"
  );
  const maxHours = options.maxHours ?? 96;
  const botCount = options.botCount ?? DEFAULT_BOT_COUNT;
  const districtCount = options.districtCount ?? DEFAULT_DISTRICT_COUNT;
  const baseSeed = options.seed ?? "free-mode-faction-passive-audit";
  const results = Array.from({ length: seedCount }, (_, index) =>
    runFreeModePacingSimulation({
      ...options,
      seed: `${baseSeed}:${index + 1}`,
      seedCount: undefined,
      botCount,
      districtCount,
      maxHours,
      checkpointHours: options.checkpointHours ?? [24, 48, 72, 96],
      variant,
      variantName: undefined
    })
  );
  const factionWinRate = createFactionWinRate(results.map((result) => result.finalState));
  const factionStats = aggregateFactionBalanceStats(
    results.map((result) => result.factionBalanceStats),
    factionWinRate
  );

  return {
    variantName: variant.variantName,
    seedCount,
    simulatedHours: maxHours,
    botCount,
    districtCount,
    results,
    factionStats,
    behaviorProfileByFaction: createBehaviorProfileReport(),
    factionAttackRate: mapFactionStats(factionStats, "averageAttackCount"),
    factionSpyRate: mapFactionStats(factionStats, "averageSpyAttempts"),
    factionExpansionRate: mapFactionStats(factionStats, "averageSuccessfulAttacks"),
    factionAverageHeat: mapFactionStats(factionStats, "averageHeat"),
    factionDangerZoneEscapes: mapFactionStats(factionStats, "dangerZoneEscapes"),
    factionTop8Rate: createTop8RateMap(factionStats, botCount),
    factionAverageFinalPlacement: mapFactionStats(factionStats, "averageFinalPlacement"),
    topFactionByControl: findTopFactionByMetric(factionStats, "averageControlledDistricts"),
    strongestFaction: findTopFactionByMetric(factionStats, "averageFinalPlacement", "asc"),
    weakestFaction: findTopFactionByMetric(factionStats, "averageFinalPlacement", "desc")
  };
};

const mapFactionStats = (
  stats: PacingMultiSeedFactionReport["factionStats"],
  key: keyof PacingMultiSeedFactionReport["factionStats"][PlayerFactionId]
): Record<PlayerFactionId, number> =>
  Object.fromEntries(PLAYER_FACTION_IDS.map((factionId) => [factionId, round(Number(stats[factionId]?.[key] ?? 0))])) as Record<PlayerFactionId, number>;

const createTop8RateMap = (
  stats: PacingMultiSeedFactionReport["factionStats"],
  botCount: number
): Record<PlayerFactionId, number> =>
  Object.fromEntries(
    PLAYER_FACTION_IDS.map((factionId) => {
      const expectedPlayers = Math.max(1, countFactionBots(botCount, factionId));
      return [factionId, round(Number(stats[factionId]?.reachedTop8Count ?? 0) / expectedPlayers)];
    })
  ) as Record<PlayerFactionId, number>;

const countFactionBots = (botCount: number, factionId: PlayerFactionId): number =>
  Array.from({ length: Math.max(0, Math.floor(botCount)) }, (_, index) => PLAYER_FACTION_IDS[index % PLAYER_FACTION_IDS.length])
    .filter((entry) => entry === factionId)
    .length;

const findTopFactionByMetric = (
  stats: PacingMultiSeedFactionReport["factionStats"],
  key: keyof PacingMultiSeedFactionReport["factionStats"][PlayerFactionId],
  direction: "asc" | "desc" = "desc"
): PlayerFactionId | null => {
  const sorted = [...PLAYER_FACTION_IDS].sort((left, right) => {
    const leftValue = Number(stats[left]?.[key] ?? 0);
    const rightValue = Number(stats[right]?.[key] ?? 0);
    return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
  });
  return sorted[0] ?? null;
};

const round = (value: number): number => Math.round(value * 100) / 100;
