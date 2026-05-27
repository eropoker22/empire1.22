import {
  aggregateMatrixStats,
  average,
  pickBestEntity,
  pickWorstEntity,
  sum
} from "./math";
import type { FreeBrMatrixReport, FreeBrScenarioName, FreeBrSimulationReport } from "./types";

export const buildMatrixReport = (
  reports: FreeBrSimulationReport[],
  scenarioNames: FreeBrScenarioName[],
  runs: number
): FreeBrMatrixReport => {
  const summaries = reports.map((report) => report.summary);
  const playerAudits = reports.flatMap((report) => report.players.map((player) => ({ report, player })));
  const byFaction = aggregateMatrixStats(playerAudits.map(({ report, player }) => ({
    key: player.factionId,
    placement: player.finalPlacement,
    top8: player.finalPlacement <= 8,
    win: report.summary.winner === player.playerId
  })));
  const byStrategy = aggregateMatrixStats(playerAudits.map(({ report, player }) => ({
    key: player.strategyId,
    placement: player.finalPlacement,
    top8: player.finalPlacement <= 8,
    win: report.summary.winner === player.playerId
  })));
  const earlyDowntownTop8 = reports.filter((report) => report.downtown.earlyOwnerSurvivedTop8).length / Math.max(1, reports.length);
  const comebackRate = sum(summaries.map((summary) => summary.totalDangerZoneComebacks)) / Math.max(1, sum(summaries.map((summary) => summary.totalDangerZoneAppearances)));
  return {
    scenarioNames,
    runs,
    summaries,
    byFaction,
    byStrategy,
    averageMatchDuration: average(summaries.map((summary) => summary.totalSimulatedHours)),
    averageAttacksPerMatch: average(summaries.map((summary) => summary.totalAttacks)),
    averageAlliancesPerMatch: average(summaries.map((summary) => summary.totalAlliancesFormed)),
    averageQuietHourDeferrals: average(summaries.map((summary) => summary.quietHoursDeferredEliminations)),
    averageDowntownSnowballRate: reports.filter((report) => report.downtown.verdict === "risky" || report.downtown.verdict === "broken").length / Math.max(1, reports.length),
    earlyDowntownOwnerTop8Chance: earlyDowntownTop8,
    victoryBeforeTimeoutChance: summaries.filter((summary) => summary.winner && !summary.hardTimeoutReached).length / Math.max(1, summaries.length),
    timeoutWithoutWinnerChance: summaries.filter((summary) => summary.hardTimeoutReached && !summary.winner).length / Math.max(1, summaries.length),
    dangerZoneComebackRate: comebackRate,
    averagePoliceRaidsPerMatch: average(summaries.map((summary) => summary.totalPoliceRaids)),
    mostDominantFaction: pickBestEntity(byFaction),
    weakestFaction: pickWorstEntity(byFaction),
    mostReliableStrategy: pickBestEntity(byStrategy),
    mostRiskyStrategy: pickWorstEntity(byStrategy)
  };
};
