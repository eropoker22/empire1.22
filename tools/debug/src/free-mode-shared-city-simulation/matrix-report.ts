import type { FreeModeSharedCityScenarioMatrixResult } from "./types";

export const formatScenarioMatrixReport = (
  matrix: FreeModeSharedCityScenarioMatrixResult
): string => {
  const lines = [
    "Free-mode shared city scenario matrix",
    "scenario | players | profiles | rounds | ticks | accepted | spy/attack/collect | acceptance | dead-turns | avgHeat | maxHeat | hard | warnings"
  ];

  for (const entry of matrix.scenarios) {
    const report = entry.report;
    lines.push([
      entry.scenario.name,
      report.playerCount,
      formatProfiles(report.profileAssignmentSummary),
      report.roundsPlayed,
      report.tickCount,
      report.actionsAccepted,
      `${report.acceptedActionsByType["spy-district"] ?? 0}/${report.acceptedActionsByType["attack-district"] ?? 0}/${report.acceptedActionsByType["collect-production"] ?? 0}`,
      formatRate(report.kpi.actionAcceptanceRate),
      formatRate(report.kpi.turnsWithoutValidActionRate),
      report.averageHeat,
      report.maxHeat,
      report.kpi.hardPassed ? "PASS" : "FAIL",
      report.kpi.softWarnings.map((warning) => warning.code).join(",") || "-"
    ].join(" | "));
  }

  return lines.join("\n");
};

const formatRate = (value: number): string => `${Math.round(value * 100)}%`;

const formatProfiles = (profiles: Record<string, number>): string =>
  Object.entries(profiles).map(([profile, count]) => `${profile}:${count}`).join(",") || "-";
