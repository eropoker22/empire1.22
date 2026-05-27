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
  const top3Entries = reports.flatMap((report) =>
    report.summary.finalTop3.map((entry) => {
      const player = report.players.find((candidate) => candidate.playerId === entry.playerId);
      return { report, entry, player };
    }).filter((entry): entry is { report: FreeBrSimulationReport; entry: FreeBrSimulationReport["summary"]["finalTop3"][number]; player: FreeBrSimulationReport["players"][number] } => Boolean(entry.player))
  );
  const top3RateByFaction = Object.fromEntries(Object.entries(groupCounts(top3Entries.map(({ player }) => player.factionId))).map(([key, value]) => [
    key,
    value / Math.max(1, reports.length)
  ]));
  const top3RateByStrategy = Object.fromEntries(Object.entries(groupCounts(top3Entries.map(({ player }) => player.strategyId))).map(([key, value]) => [
    key,
    value / Math.max(1, reports.length)
  ]));
  const averageFinalScoreByFaction = Object.fromEntries(Object.entries(groupValues(playerAudits, ({ player }) => player.factionId, ({ player }) => player.finalScore)).map(([key, values]) => [
    key,
    average(values)
  ]));
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
    victoryBeforeTimeoutChance: summaries.filter((summary) => summary.old75ControlReached).length / Math.max(1, summaries.length),
    timeoutWithoutWinnerChance: summaries.filter((summary) => summary.hardTimeoutReached && !summary.winner).length / Math.max(1, summaries.length),
    finalLockdownWinRate: summaries.filter((summary) => summary.winReason === "final_lockdown_score" && summary.winner).length / Math.max(1, summaries.length),
    averageFinalLockdownDurationWallClock: average(summaries.map((summary) =>
      summary.finalLockdownStartedAtHour === null || summary.finalLockdownEndedAtHour === null
        ? 0
        : summary.finalLockdownEndedAtHour - summary.finalLockdownStartedAtHour
    )),
    averageFinalLockdownPausedHours: average(summaries.map((summary) => summary.finalLockdownPausedHours)),
    top3RateByFaction,
    top3RateByStrategy,
    averageFinalScoreByFaction,
    downtownBonusImpact: average(reports.flatMap((report) => report.players.map((player) => player.finalScoreBreakdown?.downtownBonus ?? 0))),
    heatPenaltyImpact: average(reports.flatMap((report) => report.players.map((player) => player.finalScoreBreakdown?.heatPenalty ?? 0))),
    dangerZoneComebackRate: comebackRate,
    averagePoliceRaidsPerMatch: average(summaries.map((summary) => summary.totalPoliceRaids)),
    mostDominantFaction: pickBestEntity(byFaction),
    weakestFaction: pickWorstEntity(byFaction),
    mostReliableStrategy: pickBestEntity(byStrategy),
    mostRiskyStrategy: pickWorstEntity(byStrategy)
  };
};

const groupCounts = (values: string[]): Record<string, number> =>
  values.reduce<Record<string, number>>((groups, value) => {
    groups[value] = (groups[value] ?? 0) + 1;
    return groups;
  }, {});

const groupValues = <T>(
  values: T[],
  keySelector: (value: T) => string,
  valueSelector: (value: T) => number
): Record<string, number[]> =>
  values.reduce<Record<string, number[]>>((groups, value) => {
    const key = keySelector(value);
    groups[key] = [...(groups[key] ?? []), valueSelector(value)];
    return groups;
  }, {});
