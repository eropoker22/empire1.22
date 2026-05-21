import type { FreeModeSharedCityScenarioMatrixResult } from "./types";

export const formatScenarioMatrixReport = (
  matrix: FreeModeSharedCityScenarioMatrixResult
): string => {
  const lines = [
    "Free-mode shared city scenario matrix",
    "scenario | players | profiles | minutes | rounds | ticks | accepted | spy/attack/collect/craft | first action/attack | heat max | hard | warnings"
  ];

  for (const entry of matrix.scenarios) {
    const report = entry.report;
    lines.push([
      entry.scenario.name,
      report.playerCount,
      formatProfiles(report.profileAssignmentSummary),
      report.pacing.durationMinutes,
      report.roundsPlayed,
      report.tickCount,
      report.actionsAccepted,
      `${report.acceptedActionsByType["spy-district"] ?? 0}/${report.acceptedActionsByType["attack-district"] ?? 0}/${report.acceptedActionsByType["collect-production"] ?? 0}/${report.acceptedActionsByType["craft-item"] ?? 0}`,
      `${formatMinute(report.pacing.milestones.firstMeaningfulActionMinute)}/${formatMinute(report.pacing.milestones.firstAcceptedAttackMinute)}`,
      report.maxHeat,
      report.kpi.hardPassed ? "PASS" : "FAIL",
      [
        ...report.kpi.softWarnings.map((warning) => warning.code),
        ...report.pacing.warnings.map((warning) => warning.code)
      ].join(",") || "-"
    ].join(" | "));
  }

  return lines.join("\n");
};

const formatMinute = (value: number | null): string =>
  value === null ? "-" : `${value}m`;

const formatProfiles = (profiles: Record<string, number>): string =>
  Object.entries(profiles).map(([profile, count]) => `${profile}:${count}`).join(",") || "-";
