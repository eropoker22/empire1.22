import type { FreeBrMatrixReport, FreeBrSimulationReport } from "./types";

export interface FreeBrReportHighlights {
  winner: string | null;
  topEight: string[];
  totalAttacks: number;
  totalOccupations: number;
  totalSpyActions: number;
  totalBuildingActions: number;
  totalCraftActions: number;
  totalPoliceRaids: number;
  totalAlliancesFormed: number;
  totalAlliancesBroken: number;
  strongestFaction: string | null;
  weakestFaction: string | null;
  strongestStrategy: string | null;
  weakestStrategy: string | null;
  downtownVerdict: string;
  victoryReached: boolean;
  dangerZoneComebackRate: number;
}

export const summarizeFreeBrReport = (report: FreeBrSimulationReport): FreeBrReportHighlights => {
  const strongestFaction = [...report.factions].sort((left, right) =>
    (left.averagePlacement - right.averagePlacement)
    || (right.survivalToTop8Count - left.survivalToTop8Count)
  )[0]?.factionId ?? null;
  const weakestFaction = [...report.factions].sort((left, right) =>
    (right.averagePlacement - left.averagePlacement)
    || (left.survivalToTop8Count - right.survivalToTop8Count)
  )[0]?.factionId ?? null;
  const strongestStrategy = [...report.strategies].sort((left, right) =>
    (right.winRate - left.winRate)
    || (right.top8Rate - left.top8Rate)
    || (left.averagePlacement - right.averagePlacement)
  )[0]?.strategyId ?? null;
  const weakestStrategy = [...report.strategies].sort((left, right) =>
    (left.winRate - right.winRate)
    || (left.top8Rate - right.top8Rate)
    || (right.averagePlacement - left.averagePlacement)
  )[0]?.strategyId ?? null;

  return {
    winner: report.summary.winner,
    topEight: report.players.filter((player) => player.finalPlacement <= 8).map((player) => player.playerId),
    totalAttacks: report.summary.totalAttacks,
    totalOccupations: report.summary.occupiedNeutralDistricts,
    totalSpyActions: report.summary.totalSpyActions,
    totalBuildingActions: report.summary.totalBuildingActions,
    totalCraftActions: report.summary.totalCraftActions,
    totalPoliceRaids: report.summary.totalPoliceRaids,
    totalAlliancesFormed: report.summary.totalAlliancesFormed,
    totalAlliancesBroken: report.summary.totalAlliancesBroken,
    strongestFaction,
    weakestFaction,
    strongestStrategy,
    weakestStrategy,
    downtownVerdict: report.downtown.verdict,
    victoryReached: Boolean(report.summary.winner),
    dangerZoneComebackRate: report.summary.totalDangerZoneAppearances === 0
      ? 0
      : round2(report.summary.totalDangerZoneComebacks / report.summary.totalDangerZoneAppearances)
  };
};

export const summarizeFreeBrMatrix = (matrix: FreeBrMatrixReport): string[] => [
  `Scenarios: ${matrix.scenarioNames.join(", ")}`,
  `Runs per scenario: ${matrix.runs}`,
  `Average duration: ${matrix.averageMatchDuration}h`,
  `Average attacks: ${matrix.averageAttacksPerMatch}`,
  `Victory before timeout: ${(matrix.victoryBeforeTimeoutChance * 100).toFixed(0)}%`,
  `Timeout without winner: ${(matrix.timeoutWithoutWinnerChance * 100).toFixed(0)}%`,
  `Dominant faction: ${matrix.mostDominantFaction ?? "n/a"}`,
  `Weakest faction: ${matrix.weakestFaction ?? "n/a"}`,
  `Reliable strategy: ${matrix.mostReliableStrategy ?? "n/a"}`,
  `Risky strategy: ${matrix.mostRiskyStrategy ?? "n/a"}`
];

const round2 = (value: number): number => Math.round(value * 100) / 100;
