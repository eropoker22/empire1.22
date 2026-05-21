import type {
  FreeModeSharedCityBottleneckResource,
  FreeModeSharedCityHeatRaidPressure,
  FreeModeSharedCityPacingMilestones,
  FreeModeSharedCityPacingReport,
  FreeModeSharedCityPacingWarning,
  FreeModeSharedCityPhaseIncome,
  FreeModeSharedCityResourceSnapshot,
  FreeModeSharedCitySimulationFinalReport,
  FreeModeSharedCitySimulationRoundMetrics
} from "./types";

export const createPacingReport = (input: {
  final: FreeModeSharedCitySimulationFinalReport;
  perRound: FreeModeSharedCitySimulationRoundMetrics[];
  scenarioName: string;
  durationMinutes: number;
  tickRateMs: number;
}): FreeModeSharedCityPacingReport => {
  const durationMinutes = input.durationMinutes || minutesForTick(input.final.tickCount, input.tickRateMs);
  const resourceBalancesOverTime = input.perRound.map((round) => createResourceSnapshot(round, input.final.playerCount));
  const milestones = createMilestones(input.perRound);
  const heatRaidPressure = createHeatRaidPressure(input.final, input.perRound);
  const bottleneckResources = createBottleneckResources(input.final, input.perRound);
  const incomePerPhase = createIncomePerPhase(input.perRound, durationMinutes);

  return {
    scenarioName: input.scenarioName,
    durationMinutes,
    playerCount: input.final.playerCount,
    tickRateMs: input.tickRateMs,
    resourceBalancesOverTime,
    incomePerPhase,
    milestones,
    heatRaidPressure,
    bottleneckResources,
    warnings: createPacingWarnings({
      final: input.final,
      perRound: input.perRound,
      milestones,
      heatRaidPressure,
      bottleneckResources,
      durationMinutes
    })
  };
};

export const createEmptyPacingReport = (
  scenarioName: string
): FreeModeSharedCityPacingReport => ({
  scenarioName,
  durationMinutes: 0,
  playerCount: 0,
  tickRateMs: 5000,
  resourceBalancesOverTime: [],
  incomePerPhase: [],
  milestones: {
    firstMeaningfulActionMinute: null,
    firstProductionCollectionMinute: null,
    firstCraftStartedMinute: null,
    firstAttackReadinessMinute: null,
    firstAcceptedAttackMinute: null,
    firstExpansionMinute: null
  },
  heatRaidPressure: {
    averageHeatFinal: 0,
    maxHeatFinal: 0,
    maxHeatObserved: 0,
    roundsAboveHeat20: 0,
    roundsAboveHeat40: 0
  },
  bottleneckResources: [],
  warnings: []
});

const createResourceSnapshot = (
  round: FreeModeSharedCitySimulationRoundMetrics,
  playerCount: number
): FreeModeSharedCityResourceSnapshot => ({
  round: round.round,
  minute: round.minuteAfterRound,
  tick: round.tickAfterRound,
  totalResourcesByKey: { ...round.totalResourcesByKey },
  averageResourcesByPlayer: divideRecord(round.totalResourcesByKey, Math.max(1, playerCount)),
  ownedDistricts: round.ownedDistricts,
  neutralDistricts: round.neutralDistricts,
  acceptedActionsByType: { ...round.acceptedActionsByType }
});

const createMilestones = (
  perRound: FreeModeSharedCitySimulationRoundMetrics[]
): FreeModeSharedCityPacingMilestones => {
  const initialOwnedDistricts = perRound[0]?.ownedDistricts ?? 0;

  return {
    firstMeaningfulActionMinute: firstMinute(perRound, (round) => round.actionsAccepted > 0),
    firstProductionCollectionMinute: firstMinute(perRound, (round) => (round.acceptedActionsByType["collect-production"] ?? 0) > 0),
    firstCraftStartedMinute: firstMinute(perRound, (round) => (round.acceptedActionsByType["craft-item"] ?? 0) > 0),
    firstAttackReadinessMinute: firstMinute(perRound, (round) => round.attackReadyPlayers > 0),
    firstAcceptedAttackMinute: firstMinute(perRound, (round) => (round.acceptedActionsByType["attack-district"] ?? 0) > 0),
    firstExpansionMinute: firstMinute(perRound, (round) => round.ownedDistricts > initialOwnedDistricts)
  };
};

const createHeatRaidPressure = (
  final: FreeModeSharedCitySimulationFinalReport,
  perRound: FreeModeSharedCitySimulationRoundMetrics[]
): FreeModeSharedCityHeatRaidPressure => ({
  averageHeatFinal: final.averageHeat,
  maxHeatFinal: final.maxHeat,
  maxHeatObserved: Math.max(final.maxHeat, ...perRound.map((round) => round.maxHeat)),
  roundsAboveHeat20: perRound.filter((round) => round.maxHeat >= 20).length,
  roundsAboveHeat40: perRound.filter((round) => round.maxHeat >= 40).length
});

const createBottleneckResources = (
  final: FreeModeSharedCitySimulationFinalReport,
  perRound: FreeModeSharedCitySimulationRoundMetrics[]
): FreeModeSharedCityBottleneckResource[] => {
  const startingTotals = perRound[0]?.totalResourcesByKey ?? {};
  const keys = new Set([...Object.keys(final.totalResourcesByKey), ...Object.keys(startingTotals)]);

  return [...keys]
    .map((resourceKey) => {
      const finalTotal = final.totalResourcesByKey[resourceKey] ?? 0;
      const totalDelta = round(finalTotal - (startingTotals[resourceKey] ?? 0));
      const finalAveragePerPlayer = round(finalTotal / Math.max(1, final.playerCount));
      const lowAverage = finalAveragePerPlayer <= 5;
      const depleted = totalDelta < 0;
      if (!lowAverage && !depleted) return null;
      return {
        resourceKey,
        finalAveragePerPlayer,
        totalDelta,
        reason: depleted ? "net resource drain during window" : "very low final average per player"
      };
    })
    .filter((entry): entry is FreeModeSharedCityBottleneckResource => Boolean(entry))
    .sort((left, right) => left.finalAveragePerPlayer - right.finalAveragePerPlayer || left.resourceKey.localeCompare(right.resourceKey));
};

const createIncomePerPhase = (
  perRound: FreeModeSharedCitySimulationRoundMetrics[],
  durationMinutes: number
): FreeModeSharedCityPhaseIncome[] => {
  const phaseDefinitions = [
    { phase: "early" as const, start: 0, end: durationMinutes / 3 },
    { phase: "mid" as const, start: durationMinutes / 3, end: durationMinutes * 2 / 3 },
    { phase: "late" as const, start: durationMinutes * 2 / 3, end: durationMinutes }
  ];

  return phaseDefinitions.map((definition) => {
    const rounds = perRound.filter((round) =>
      round.minuteAfterRound > definition.start && round.minuteAfterRound <= definition.end
    );
    return {
      phase: definition.phase,
      startMinute: round(definition.start),
      endMinute: round(definition.end),
      resourceDeltaByKey: sumRecords(rounds.map((entry) => entry.resourceDeltaByKey)),
      acceptedActionsByType: sumRecords(rounds.map((entry) => entry.acceptedActionsByType))
    };
  });
};

const createPacingWarnings = (input: {
  final: FreeModeSharedCitySimulationFinalReport;
  perRound: FreeModeSharedCitySimulationRoundMetrics[];
  milestones: FreeModeSharedCityPacingMilestones;
  heatRaidPressure: FreeModeSharedCityHeatRaidPressure;
  bottleneckResources: FreeModeSharedCityBottleneckResource[];
  durationMinutes: number;
}): FreeModeSharedCityPacingWarning[] => [
  input.milestones.firstMeaningfulActionMinute === null || input.milestones.firstMeaningfulActionMinute > 5
    ? warning("slow-first-action", "No accepted action within the first 5 minutes.", "critical")
    : null,
  input.milestones.firstProductionCollectionMinute === null
    ? warning("no-production-collection", "No collect-production action completed in the simulated window.", "warning")
    : null,
  input.milestones.firstCraftStartedMinute === null
    ? warning("no-crafting", "No craft-item action started in the simulated window.", "info")
    : null,
  input.milestones.firstAttackReadinessMinute === null || input.milestones.firstAttackReadinessMinute > Math.min(30, input.durationMinutes)
    ? warning("slow-attack-readiness", "No player became attack-ready in the first 30 minutes/window.", "warning")
    : null,
  input.milestones.firstAcceptedAttackMinute === null
    ? warning("no-accepted-attack", "No attack command was accepted in the simulated window.", "warning")
    : null,
  input.final.turnsWithoutValidAction > input.final.actionsAccepted
    ? warning("dead-turn-pressure", "More turns had no valid action than accepted commands.", "critical")
    : null,
  input.heatRaidPressure.maxHeatObserved >= 40
    ? warning("high-heat-pressure", "Max heat crossed 40; review raid pressure for early pacing.", "warning")
    : null,
  input.bottleneckResources.length > 0
    ? warning("resource-bottlenecks", "One or more resources ended depleted or near zero.", "info")
    : null
].filter((entry): entry is FreeModeSharedCityPacingWarning => Boolean(entry));

const firstMinute = (
  perRound: FreeModeSharedCitySimulationRoundMetrics[],
  predicate: (round: FreeModeSharedCitySimulationRoundMetrics) => boolean
): number | null =>
  perRound.find(predicate)?.minuteAfterRound ?? null;

const warning = (
  code: string,
  message: string,
  severity: FreeModeSharedCityPacingWarning["severity"]
): FreeModeSharedCityPacingWarning => ({ code, message, severity });

const sumRecords = (records: Record<string, number>[]): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      totals[key] = round((totals[key] ?? 0) + value);
    }
  }
  return totals;
};

const divideRecord = (record: Record<string, number>, divisor: number): Record<string, number> =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, round(value / divisor)]));

const minutesForTick = (tick: number, tickRateMs: number): number =>
  round(tick * tickRateMs / 60000);

const round = (value: number): number =>
  Math.round(value * 100) / 100;
