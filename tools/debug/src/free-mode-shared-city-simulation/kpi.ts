import type {
  FreeModeSharedCitySimulationFinalReport,
  SimulationKpiEvaluation,
  SimulationKpiHardAssertion,
  SimulationKpiSoftWarning
} from "./types";

const MIN_ACCEPTANCE_RATE = 0.6;
const MAX_DEAD_TURN_RATE = 0.25;
const SPY_HEAVY_RATIO = 3;
const HEAT_SPIKE_THRESHOLD = 40;

export const evaluateSimulationKpis = (
  report: FreeModeSharedCitySimulationFinalReport,
  expectedPlayerCount = report.playerCount,
  expectedMinimumTick = 0
): SimulationKpiEvaluation => {
  const actionTurns = report.actionsAttempted + report.turnsWithoutValidAction;
  const actionAcceptanceRate = round(report.actionsAccepted / Math.max(1, report.actionsAttempted));
  const turnsWithoutValidActionRate = round(report.turnsWithoutValidAction / Math.max(1, actionTurns));
  const spyAccepted = report.acceptedActionsByType["spy-district"] ?? 0;
  const attackAccepted = report.acceptedActionsByType["attack-district"] ?? 0;
  const spyToAttackRatio = round(spyAccepted / Math.max(1, attackAccepted));
  const hardAssertions = createHardAssertions(report, expectedPlayerCount, expectedMinimumTick);
  const softWarnings = createSoftWarnings(report, actionAcceptanceRate, spyToAttackRatio, turnsWithoutValidActionRate);

  return {
    hardPassed: hardAssertions.every((entry) => entry.passed),
    hardAssertions,
    softWarnings,
    actionAcceptanceRate,
    turnsWithoutValidActionRate,
    spyToAttackRatio
  };
};

const createHardAssertions = (
  report: FreeModeSharedCitySimulationFinalReport,
  expectedPlayerCount: number,
  expectedMinimumTick: number
): SimulationKpiHardAssertion[] => [
  // This harness is a diagnostic/dev-only stability check. Pacing signals stay soft
  // until core battle royale mechanics and balance targets are locked.
  {
    name: "connectedMap",
    passed: report.connectedMap,
    actual: report.connectedMap,
    expected: "true"
  },
  {
    name: "crashedInstances",
    passed: report.crashedInstances === 0,
    actual: report.crashedInstances,
    expected: "0"
  },
  {
    name: "playerCount",
    passed: report.playerCount === expectedPlayerCount,
    actual: report.playerCount,
    expected: `${expectedPlayerCount}`
  },
  {
    name: "uniqueHomeDistricts",
    passed: report.uniqueHomeDistricts === report.playerCount,
    actual: report.uniqueHomeDistricts,
    expected: `playerCount (${report.playerCount})`
  },
  {
    name: "tickProgressed",
    passed: report.tickCount >= expectedMinimumTick,
    actual: report.tickCount,
    expected: `>= ${expectedMinimumTick}`
  }
];

const createSoftWarnings = (
  report: FreeModeSharedCitySimulationFinalReport,
  actionAcceptanceRate: number,
  spyToAttackRatio: number,
  turnsWithoutValidActionRate: number
): SimulationKpiSoftWarning[] => [
  actionAcceptanceRate < MIN_ACCEPTANCE_RATE
    ? createWarning("low-action-acceptance", "Action acceptance is below the diagnostic pacing threshold.", actionAcceptanceRate, MIN_ACCEPTANCE_RATE)
    : null,
  spyToAttackRatio > SPY_HEAVY_RATIO
    ? createWarning("spy-heavy", "Spy actions dominate attacks.", spyToAttackRatio, SPY_HEAVY_RATIO)
    : null,
  (report.acceptedActionsByType["attack-district"] ?? 0) === 0
    ? createWarning("low-conflict", "No accepted attack actions were produced.", 0, 1)
    : null,
  (report.acceptedActionsByType["attack-district"] ?? 0) === 0
    ? createWarning("too-few-attacks", "Attack volume is too low for a pacing read.", 0, 1)
    : null,
  turnsWithoutValidActionRate > MAX_DEAD_TURN_RATE
    ? createWarning("too-many-dead-turns", "Too many player turns had no valid action.", turnsWithoutValidActionRate, MAX_DEAD_TURN_RATE)
    : null,
  report.maxHeat > HEAT_SPIKE_THRESHOLD
    ? createWarning("heat-spike", "Max heat exceeded the conservative pacing threshold.", report.maxHeat, HEAT_SPIKE_THRESHOLD)
    : null,
  report.cityFeedEventsCreated === 0
    ? createWarning("no-feed", "No city feed events were created.", 0, 1)
    : null,
  (report.acceptedActionsByType["collect-production"] ?? 0) === 0
    ? createWarning("low-production", "No accepted production collection actions were produced.", 0, 1)
    : null,
  report.eliminatedPlayers === 0
    ? createWarning("no-eliminations", "No eliminations happened in this diagnostic window.", 0, 1)
    : null
].filter((entry): entry is SimulationKpiSoftWarning => Boolean(entry));

const createWarning = (
  code: string,
  message: string,
  value: number,
  threshold: number
): SimulationKpiSoftWarning => ({
  code,
  message,
  value: round(value),
  threshold
});

const round = (value: number): number => Math.round(value * 100) / 100;
