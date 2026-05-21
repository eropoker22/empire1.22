import {
  FREE_MODE_BALANCE_GATE_SCENARIOS,
  FREE_MODE_BALANCE_THRESHOLDS,
  type FreeModeBalanceThresholdConfig
} from "./balance-thresholds";
import { runFreeModeScenarioMatrix } from "./scenarios";
import type {
  FreeModeSharedCityScenarioMatrixResult,
  FreeModeSharedCityScenarioName,
  FreeModeSharedCitySimulationReport
} from "./types";

export interface FreeModeBalanceGateIssue {
  severity: "hard" | "soft";
  code: string;
  message: string;
  scenarioName: string;
  value: number | string | boolean | null;
  threshold: number | string | boolean;
}

export interface FreeModeBalanceGateScenarioResult {
  scenarioName: string;
  hardPassed: boolean;
  issues: FreeModeBalanceGateIssue[];
}

export interface FreeModeBalanceGateResult {
  hardPassed: boolean;
  thresholds: FreeModeBalanceThresholdConfig;
  scenarios: FreeModeBalanceGateScenarioResult[];
}

export const runFreeModeBalanceGate = async (
  scenarioNames: FreeModeSharedCityScenarioName[] = [...FREE_MODE_BALANCE_GATE_SCENARIOS],
  thresholds = FREE_MODE_BALANCE_THRESHOLDS
): Promise<FreeModeBalanceGateResult> =>
  evaluateFreeModeBalanceMatrix(await runFreeModeScenarioMatrix(scenarioNames), thresholds);

export const evaluateFreeModeBalanceMatrix = (
  matrix: FreeModeSharedCityScenarioMatrixResult,
  thresholds = FREE_MODE_BALANCE_THRESHOLDS
): FreeModeBalanceGateResult => {
  const scenarios = matrix.scenarios.map((entry) =>
    evaluateFreeModeBalanceReport(entry.report, thresholds)
  );

  return {
    hardPassed: scenarios.every((scenario) => scenario.hardPassed),
    thresholds,
    scenarios
  };
};

export const evaluateFreeModeBalanceReport = (
  report: FreeModeSharedCitySimulationReport,
  thresholds = FREE_MODE_BALANCE_THRESHOLDS
): FreeModeBalanceGateScenarioResult => {
  const scenarioName = report.pacing.scenarioName;
  const issues = [
    ...createHardIssues(report, thresholds, scenarioName),
    ...createSoftIssues(report, thresholds, scenarioName)
  ];

  return {
    scenarioName,
    hardPassed: issues.every((issue) => issue.severity !== "hard"),
    issues
  };
};

export const formatFreeModeBalanceGateResult = (
  result: FreeModeBalanceGateResult
): string => {
  const lines = [
    "Free-mode balance gate",
    `hard status: ${result.hardPassed ? "PASS" : "FAIL"}`,
    "scenario | hard | hard issues | soft warnings"
  ];

  for (const scenario of result.scenarios) {
    const hard = scenario.issues.filter((issue) => issue.severity === "hard");
    const soft = scenario.issues.filter((issue) => issue.severity === "soft");
    lines.push([
      scenario.scenarioName,
      scenario.hardPassed ? "PASS" : "FAIL",
      hard.map((issue) => issue.code).join(",") || "-",
      soft.map((issue) => issue.code).join(",") || "-"
    ].join(" | "));
  }

  return lines.join("\n");
};

const createHardIssues = (
  report: FreeModeSharedCitySimulationReport,
  thresholds: FreeModeBalanceThresholdConfig,
  scenarioName: string
): FreeModeBalanceGateIssue[] => [
  !report.connectedMap
    ? issue("hard", "map-disconnected", "Shared city graph disconnected.", scenarioName, false, true)
    : null,
  report.crashedInstances > 0
    ? issue("hard", "instance-crash", "Simulation reported crashed instances.", scenarioName, report.crashedInstances, 0)
    : null,
  report.actionsAccepted <= 0
    ? issue("hard", "no-accepted-actions", "No accepted actions; gameplay loop is deadlocked.", scenarioName, report.actionsAccepted, "> 0")
    : null,
  report.pacing.milestones.firstMeaningfulActionMinute === null ||
    report.pacing.milestones.firstMeaningfulActionMinute > thresholds.firstMeaningfulActionMaxMinute
    ? issue("hard", "first-action-deadlock", "First meaningful action missed the hard gate.", scenarioName, report.pacing.milestones.firstMeaningfulActionMinute, `<= ${thresholds.firstMeaningfulActionMaxMinute}m`)
    : null,
  report.uniqueHomeDistricts < report.playerCount
    ? issue("hard", "home-district-collision", "At least one player did not receive a unique home district.", scenarioName, report.uniqueHomeDistricts, report.playerCount)
    : null
].filter((entry): entry is FreeModeBalanceGateIssue => Boolean(entry));

const createSoftIssues = (
  report: FreeModeSharedCitySimulationReport,
  thresholds: FreeModeBalanceThresholdConfig,
  scenarioName: string
): FreeModeBalanceGateIssue[] => {
  const milestones = report.pacing.milestones;
  const earlyHeat = Math.max(0, ...report.perRound
    .filter((round) => round.minuteAfterRound <= thresholds.earlyHeatWindowMinute)
    .map((round) => round.maxHeat));
  const softIssues = [
    milestoneIssue("slow-production-collection", "Production collection is later than the MVP target.", scenarioName, milestones.firstProductionCollectionMinute, thresholds.firstProductionCollectionMaxMinute),
    milestoneIssue("slow-craft", "First craft is later than the MVP target.", scenarioName, milestones.firstCraftStartedMinute, thresholds.firstCraftStartedMaxMinute),
    milestones.firstAttackReadinessMinute !== null && milestones.firstAttackReadinessMinute < thresholds.attackReadinessMinMinute
      ? issue("soft", "attack-ready-too-early", "Attack readiness appears before the MVP target window.", scenarioName, milestones.firstAttackReadinessMinute, `>= ${thresholds.attackReadinessMinMinute}m`)
      : milestoneIssue("slow-attack-readiness", "Attack readiness is later than the MVP target.", scenarioName, milestones.firstAttackReadinessMinute, thresholds.attackReadinessMaxMinute),
    earlyHeat > thresholds.maxHeatBeforeEarlyWindow
      ? issue("soft", "early-heat-spike", "Heat exceeds the early-window target.", scenarioName, earlyHeat, `<= ${thresholds.maxHeatBeforeEarlyWindow}`)
      : null,
    report.kpi.actionAcceptanceRate < thresholds.minActionAcceptanceRate
      ? issue("soft", "low-action-acceptance", "Accepted action rate is below target.", scenarioName, report.kpi.actionAcceptanceRate, `>= ${thresholds.minActionAcceptanceRate}`)
      : null,
    report.kpi.turnsWithoutValidActionRate > thresholds.maxDeadTurnRate
      ? issue("soft", "high-dead-turn-rate", "Dead-turn rate is above target.", scenarioName, report.kpi.turnsWithoutValidActionRate, `<= ${thresholds.maxDeadTurnRate}`)
      : null,
    ...report.pacing.warnings.map((warning) =>
      issue("soft", `pacing:${warning.code}`, warning.message, scenarioName, warning.severity, "review")
    )
  ];

  return softIssues.filter((entry): entry is FreeModeBalanceGateIssue => Boolean(entry));
};

const milestoneIssue = (
  code: string,
  message: string,
  scenarioName: string,
  value: number | null,
  maxMinute: number
): FreeModeBalanceGateIssue | null =>
  value === null || value > maxMinute
    ? issue("soft", code, message, scenarioName, value, `<= ${maxMinute}m`)
    : null;

const issue = (
  severity: FreeModeBalanceGateIssue["severity"],
  code: string,
  message: string,
  scenarioName: string,
  value: FreeModeBalanceGateIssue["value"],
  threshold: FreeModeBalanceGateIssue["threshold"]
): FreeModeBalanceGateIssue => ({ severity, code, message, scenarioName, value, threshold });
