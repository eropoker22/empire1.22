import type { FreeModeSharedCityPacingReport } from "./types";

export const formatPacingReport = (report: FreeModeSharedCityPacingReport): string => {
  const lines = [
    `Free-mode pacing report: ${report.scenarioName}`,
    `players=${report.playerCount} duration=${round(report.durationMinutes)}m tickRateMs=${report.tickRateMs}`,
    "",
    "Milestones",
    `- first meaningful action: ${formatMinute(report.milestones.firstMeaningfulActionMinute)}`,
    `- first production collection: ${formatMinute(report.milestones.firstProductionCollectionMinute)}`,
    `- first craft started: ${formatMinute(report.milestones.firstCraftStartedMinute)}`,
    `- first attack readiness: ${formatMinute(report.milestones.firstAttackReadinessMinute)}`,
    `- first accepted attack: ${formatMinute(report.milestones.firstAcceptedAttackMinute)}`,
    `- first expansion: ${formatMinute(report.milestones.firstExpansionMinute)}`,
    "",
    "Income per phase",
    "phase | minutes | resource deltas | accepted actions"
  ];

  for (const phase of report.incomePerPhase) {
    lines.push([
      phase.phase,
      `${round(phase.startMinute)}-${round(phase.endMinute)}`,
      formatRecord(phase.resourceDeltaByKey),
      formatRecord(phase.acceptedActionsByType)
    ].join(" | "));
  }

  lines.push("", "Resource balances over time", "minute | owned/neutral | total resources | accepted actions");
  for (const snapshot of report.resourceBalancesOverTime) {
    lines.push([
      round(snapshot.minute),
      `${snapshot.ownedDistricts}/${snapshot.neutralDistricts}`,
      formatRecord(snapshot.totalResourcesByKey),
      formatRecord(snapshot.acceptedActionsByType)
    ].join(" | "));
  }

  lines.push(
    "",
    "Heat / raid pressure",
    `- average heat final: ${report.heatRaidPressure.averageHeatFinal}`,
    `- max heat final: ${report.heatRaidPressure.maxHeatFinal}`,
    `- max heat observed: ${report.heatRaidPressure.maxHeatObserved}`,
    `- rounds above heat 20/40: ${report.heatRaidPressure.roundsAboveHeat20}/${report.heatRaidPressure.roundsAboveHeat40}`,
    "",
    "Bottleneck resources"
  );

  lines.push(...formatBottlenecks(report));
  lines.push("", "Warnings", ...formatWarnings(report));
  return lines.join("\n");
};

const formatBottlenecks = (report: FreeModeSharedCityPacingReport): string[] =>
  report.bottleneckResources.length === 0
    ? ["- none detected"]
    : report.bottleneckResources.map((resource) =>
        `- ${resource.resourceKey}: avg/player=${resource.finalAveragePerPlayer}, delta=${resource.totalDelta}, ${resource.reason}`
      );

const formatWarnings = (report: FreeModeSharedCityPacingReport): string[] =>
  report.warnings.length === 0
    ? ["- none"]
    : report.warnings.map((warning) => `- [${warning.severity}] ${warning.code}: ${warning.message}`);

const formatRecord = (record: Record<string, number>): string =>
  Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${round(value)}`)
    .join(", ") || "-";

const formatMinute = (minute: number | null): string =>
  minute === null ? "not reached" : `${round(minute)}m`;

const round = (value: number): number =>
  Math.round(value * 100) / 100;
