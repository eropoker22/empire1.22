import { summarizeFreeBrMatrix, summarizeFreeBrReport } from "./metrics";
import type { FreeBrMatrixReport, FreeBrSimulationReport } from "./types";

export const formatFreeBrMarkdownReport = (report: FreeBrSimulationReport): string => {
  const highlights = summarizeFreeBrReport(report);
  const topEight = report.players.filter((player) => player.finalPlacement <= 8);
  const topActions = report.events
    .filter((event) => event.actionType === "run-building-action")
    .reduce<Record<string, number>>((counts, event) => {
      counts[event.result] = (counts[event.result] ?? 0) + 1;
      return counts;
    }, {});
  const topBuildingRows = Object.entries(topActions)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 10)
    .map(([action, count]) => `| ${action} | ${count} |`)
    .join("\n") || "| n/a | 0 |";

  return [
    "# Free BR canonical simulation report",
    "",
    "## Executive summary",
    `- Seed: \`${report.summary.seed}\``,
    `- Scenario: \`${report.summary.scenario}\``,
    `- Simulováno: ${report.summary.totalSimulatedHours} hodin / ${report.summary.totalTicks} ticků`,
    `- Vítěz: ${report.summary.winner ?? "nikdo"} (${report.summary.winReason})`,
    `- Top 8: ${topEight.map((player) => `${player.playerName} (${player.factionId}, ${player.strategyId})`).join(", ")}`,
    `- Útoky: ${report.summary.totalAttacks} (${report.summary.successfulAttacks} výher, ${report.summary.failedAttacks} proher)`,
    `- Obsazení neutralů: ${report.summary.occupiedNeutralDistricts}`,
    `- Spy akce: ${report.summary.totalSpyActions}`,
    `- Building actions: ${report.summary.totalBuildingActions}`,
    `- Craft akce: ${report.summary.totalCraftActions}`,
    `- Police raidy: ${report.summary.totalPoliceRaids}`,
    `- Aliance: ${report.summary.totalAlliancesFormed} vzniklo, ${report.summary.totalAlliancesBroken} skončilo, ${report.summary.totalBetrayals} zrad`,
    `- Downtown verdict: ${report.downtown.verdict}`,
    "",
    "## Verdikt: je Free BR pacing zdravý?",
    verdictText(report),
    "",
    "## Co fungovalo",
    `- Makro eliminace držely top stop na ${report.configSnapshot.topStop} aktivních hráčích a po eliminaci se distrikty neutralizovaly: ${report.summary.totalNeutralizedDistrictsAfterEliminations} districtů.`,
    `- Cooldowny omezily spam: při ${report.summary.totalSimulatedHours}h vzniklo ${report.summary.totalAttacks} útoků, ${report.summary.totalSpyActions} spy akcí a ${report.summary.occupiedNeutralDistricts} neutral captures.`,
    `- Danger zone měla měřitelný comeback: ${report.summary.totalDangerZoneComebacks}/${report.summary.totalDangerZoneAppearances} záznamů (${percent(highlights.dangerZoneComebackRate)}).`,
    "",
    "## Co je rizikové",
    `- Downtown max držení jedním hráčem: ${report.downtown.maxDowntownHeldByOnePlayer}/8; early owner top 8: ${yesNo(report.downtown.earlyOwnerSurvivedTop8)}; early owner win: ${yesNo(report.downtown.earlyOwnerWon)}.`,
    `- 75% victory potřebuje ${report.summary.victoryThresholdDistricts} districtů; leader na konci držel ${report.summary.leaderDistrictsAtEnd}.`,
    `- High heat audit: nejvyšší heat ${report.police.highestHeat} u ${report.police.highestHeatPlayerId ?? "n/a"}, dirty cash seized ${report.police.totalDirtyCashSeized}.`,
    "",
    "## Co je broken",
    brokenText(report),
    "",
    "## Timeline zápasu",
    "| Hodina | Aktivní | Leader | Districts | Bottom 3 | Útoky | Obsazení | Spy | Building | Aliance | Quiet |",
    "| ---: | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.timeline.slice(0, 40).map((snapshot) =>
      `| ${snapshot.hour} | ${snapshot.activePlayers} | ${snapshot.leader ?? "n/a"} | ${snapshot.leaderDistricts} | ${snapshot.bottomThree.join(", ")} | ${snapshot.attacksThisHour} | ${snapshot.occupationsThisHour} | ${snapshot.spyActionsThisHour} | ${snapshot.buildingActionsThisHour} | ${snapshot.alliancesActive} | ${snapshot.quietHoursActive ? "ano" : "ne"} |`
    ),
    report.timeline.length > 40 ? `\n_Zkráceno: celkem ${report.timeline.length} hodinových snapshotů. Plný timeline je v JSON reportu._` : "",
    "",
    "## Eliminace",
    "| Hodina | Hráč | Frakce | Strategie | Score | Districts | Bottom 3 | Quiet defer | Neutralizováno | Důvod |",
    "| ---: | --- | --- | --- | ---: | ---: | --- | --- | ---: | --- |",
    ...report.eliminations.map((entry) =>
      `| ${entry.hour} | ${entry.playerName} | ${entry.factionId} | ${entry.strategyId} | ${round(entry.eliminationScore)} | ${entry.controlledDistricts} | ${entry.bottomThree.join(", ")} | ${entry.deferredByQuietHours ? "ano" : "ne"} | ${entry.neutralizedDistricts} | ${entry.reasonWhyWeak} |`
    ),
    report.eliminations.length === 0 ? "| n/a | n/a | n/a | n/a | 0 | 0 | n/a | ne | 0 | žádná eliminace |" : "",
    "",
    "## Danger zone a comebacky",
    `- Celkem danger zone appearances: ${report.summary.totalDangerZoneAppearances}`,
    `- Comebacky: ${report.summary.totalDangerZoneComebacks}`,
    `- Comeback rate: ${percent(highlights.dangerZoneComebackRate)}`,
    "",
    "## Aliance",
    `- Vzniklo: ${report.alliances.formed}`,
    `- Rozpadlo se: ${report.alliances.broken}`,
    `- Největší aliance: ${report.alliances.largestAlliance.allianceId ?? "n/a"} (${report.alliances.largestAlliance.size} členů)`,
    `- Koordinované útoky: ${report.alliances.coordinatedAttacks}`,
    `- Hráči přeživší v alianci: ${report.alliances.survivedDueToAlliance}`,
    "",
    "## Frakce",
    "| Frakce | Hráči | Avg placement | Best | Top 8 | Útoky | Win rate útoků | Heat avg | Comeback rate | Verdikt |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.factions.map((faction) =>
      `| ${faction.factionId} | ${faction.playersCount} | ${faction.averagePlacement} | ${faction.bestPlacement} | ${faction.survivalToTop8Count} | ${faction.totalAttacks} | ${percent(faction.attackWinRate)} | ${faction.averageHeat} | ${percent(faction.comebackRate)} | ${faction.verdict} |`
    ),
    "",
    "## Strategie",
    "| Strategie | Hráči | Avg placement | Top 8 | Win rate | Attack rate | Expansion | Alliance | Downtown success | Comeback | Police raids |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.strategies.map((strategy) =>
      `| ${strategy.strategyId} | ${strategy.playersCount} | ${strategy.averagePlacement} | ${percent(strategy.top8Rate)} | ${percent(strategy.winRate)} | ${strategy.attackRate} | ${strategy.expansionRate} | ${strategy.allianceRate} | ${percent(strategy.downtownSuccessRate)} | ${percent(strategy.dangerZoneComebackRate)} | ${strategy.policeRaidRate} |`
    ),
    "",
    "## Útoky a obsazování",
    `- Nejvíc útoků: ${mostBy(report.players, "attacksMade")}`,
    `- Nejvíc napadaný hráč approximation: ${mostTargetedPlayer(report)}`,
    `- Most contested district: ${report.districts.mostContestedDistrict ?? "n/a"}`,
    `- Downtown útoky: ${report.downtown.attacksOnDowntown}`,
    `- District ownership churn: ${report.districts.districtOwnershipChurn}`,
    "",
    "## Výroba a building actions",
    `- Craft actions: ${report.summary.totalCraftActions}`,
    `- Building actions: ${report.summary.totalBuildingActions}`,
    `- Rare building actions: ${report.summary.totalRareBuildingActions}`,
    "",
    "| Building action | Použití |",
    "| --- | ---: |",
    topBuildingRows,
    "",
    "## Downtown / rare snowball",
    `- První downtown capture: ${report.districts.firstDowntownCaptured ? `${report.districts.firstDowntownCaptured.districtId} v hodině ${report.districts.firstDowntownCaptured.hour} hráčem ${report.districts.firstDowntownCaptured.playerId}` : "nenastal"}`,
    `- Max downtown držených jedním hráčem: ${report.downtown.maxDowntownHeldByOnePlayer}`,
    `- Aliance proti downtown leaderovi: ${report.downtown.alliancesAgainstDowntownLeader}`,
    `- Verdikt: ${report.downtown.verdict}`,
    "",
    "## Heat / police",
    `- Police raids: ${report.police.totalRaids}`,
    `- Dirty cash seized: ${report.police.totalDirtyCashSeized}`,
    `- Resource seized approximation: ${report.police.totalResourceSeized}`,
    `- Highest heat player: ${report.police.highestHeatPlayerId ?? "n/a"} (${report.police.highestHeat})`,
    "",
    "## Victory / endgame",
    `- Victory reached: ${yesNo(Boolean(report.summary.winner))}`,
    `- Win reason: ${report.summary.winReason}`,
    `- 75% threshold: ${report.summary.victoryThresholdDistricts}/${report.configSnapshot.districts}`,
    `- Leader districts at end: ${report.summary.leaderDistrictsAtEnd}`,
    `- Hard timeout reached: ${yesNo(report.summary.hardTimeoutReached)}`,
    "",
    "## Doporučení pro balance",
    recommendationText(report),
    "",
    "## Doporučení pro další testy",
    "- Spouštět matrix 50-200 běhů po každém větším balance patchi cooldownů, economy nebo building actions.",
    "- Porovnat canonical-20p proti casual-heavy a downtown-rush, protože ty nejlépe odhalují onboarding frustraci a rare snowball.",
    "- Přidat budoucí integrační test přes skutečný command handler, až bude server-side orchestration plně sdílená se simulátorem.",
    "",
    "## Known approximations",
    ...report.approximations.map((item) => `- ${item}`),
    ""
  ].filter((line) => line !== undefined).join("\n");
};

export const formatFreeBrMatrixMarkdownReport = (matrix: FreeBrMatrixReport): string => [
  "# Free BR canonical simulation matrix",
  "",
  "## Summary",
  ...summarizeFreeBrMatrix(matrix).map((line) => `- ${line}`),
  "",
  "## Scénáře",
  `- ${matrix.scenarioNames.join(", ")}`,
  "",
  "## Frakce",
  "| Frakce | Runs | Wins | Win rate | Top 8 | Top 8 rate | Avg placement |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...Object.entries(matrix.byFaction).map(([faction, stats]) =>
    `| ${faction} | ${stats.runs} | ${stats.wins} | ${percent(stats.winRate)} | ${stats.top8} | ${percent(stats.top8Rate)} | ${stats.averagePlacement} |`
  ),
  "",
  "## Strategie",
  "| Strategie | Runs | Wins | Win rate | Top 8 | Top 8 rate | Avg placement |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...Object.entries(matrix.byStrategy).map(([strategy, stats]) =>
    `| ${strategy} | ${stats.runs} | ${stats.wins} | ${percent(stats.winRate)} | ${stats.top8} | ${percent(stats.top8Rate)} | ${stats.averagePlacement} |`
  ),
  "",
  "## Aggregate metrics",
  `- Average match duration: ${matrix.averageMatchDuration}h`,
  `- Average attacks per match: ${matrix.averageAttacksPerMatch}`,
  `- Average alliances per match: ${matrix.averageAlliancesPerMatch}`,
  `- Average quiet hour deferrals: ${matrix.averageQuietHourDeferrals}`,
  `- Average downtown snowball rate: ${percent(matrix.averageDowntownSnowballRate)}`,
  `- Early downtown owner top 8 chance: ${percent(matrix.earlyDowntownOwnerTop8Chance)}`,
  `- 75% victory before timeout chance: ${percent(matrix.victoryBeforeTimeoutChance)}`,
  `- Timeout without winner chance: ${percent(matrix.timeoutWithoutWinnerChance)}`,
  `- Danger zone comeback rate: ${percent(matrix.dangerZoneComebackRate)}`,
  `- Average police raids per match: ${matrix.averagePoliceRaidsPerMatch}`,
  ""
].join("\n");

export const toStableJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

const verdictText = (report: FreeBrSimulationReport): string => {
  const attackDensity = report.summary.totalAttacks / Math.max(1, report.summary.totalSimulatedHours);
  if (report.summary.winner && report.summary.totalEliminations > 0 && report.downtown.verdict !== "broken") {
    return `Simulace vypadá použitelně: ${attackDensity.toFixed(1)} útoků/h, ${report.summary.totalEliminations} eliminací a vítězství přes ${report.summary.winReason}.`;
  }
  if (report.summary.hardTimeoutReached || !report.summary.winner) {
    return `Pacing je hratelný, ale endgame je rizikový: vítěz nevznikl, leader držel ${report.summary.leaderDistrictsAtEnd}/${report.summary.victoryThresholdDistricts} potřebných districtů.`;
  }
  return "Pacing potřebuje další matrix běhy, protože canonical run nedal jednoznačný závěr.";
};

const brokenText = (report: FreeBrSimulationReport): string => {
  const issues: string[] = [];
  if (report.downtown.verdict === "broken") issues.push("Downtown snowball dosáhl broken threshold: early owner vyhrál a držel alespoň 4 downtown districty.");
  if (report.summary.totalAttacks === 0) issues.push("Simulace nevygenerovala žádné útoky, což by znamenalo mrtvý conflict loop.");
  if (report.summary.totalEliminations === 0 && report.summary.totalSimulatedHours >= 24) issues.push("Nevznikla žádná eliminace během dlouhého běhu.");
  if (issues.length === 0) return "- V tomto běhu není tvrdě broken metrika. Rizika jsou spíš v endgame/downtown pravděpodobnostech a vyžadují matrix.";
  return issues.map((issue) => `- ${issue}`).join("\n");
};

const recommendationText = (report: FreeBrSimulationReport): string => {
  const recommendations: string[] = [];
  if (!report.summary.winner) recommendations.push("- Neměnit hned 75% threshold jen podle jednoho runu; nejdřív ověřit matrix, jestli hard timeout dominuje opakovaně.");
  if (report.downtown.verdict === "risky" || report.downtown.verdict === "broken") recommendations.push("- Zkontrolovat rare/downtown reward vs heat/police pressure v dalším balance patchi.");
  if (report.summary.totalAttacks / Math.max(1, report.summary.totalSimulatedHours) < 1) recommendations.push("- Pokud matrix potvrdí nízký conflict density, zvážit jemnou motivaci k útokům, ne zkrácení BR eliminací.");
  if (report.summary.totalDangerZoneComebacks === 0 && report.summary.totalDangerZoneAppearances > 0) recommendations.push("- Danger zone hráči neměli comeback; otestovat, jestli comeback akce a neutral captures po eliminaci dávají dost šancí.");
  if (recommendations.length === 0) recommendations.push("- Teď neměnit config; nejdřív spustit matrix po dalších cooldown/economy úpravách a porovnat baseline.");
  return recommendations.join("\n");
};

const mostBy = (players: FreeBrSimulationReport["players"], key: keyof FreeBrSimulationReport["players"][number]): string => {
  const best = [...players].sort((left, right) => Number(right[key] ?? 0) - Number(left[key] ?? 0))[0];
  return best ? `${best.playerName} (${Number(best[key] ?? 0)})` : "n/a";
};

const mostTargetedPlayer = (report: FreeBrSimulationReport): string => {
  const counts = report.events
    .filter((event) => event.actionType === "attack-district" && event.targetPlayerId)
    .reduce<Record<string, number>>((totals, event) => {
      const key = event.targetPlayerId ?? "n/a";
      totals[key] = (totals[key] ?? 0) + 1;
      return totals;
    }, {});
  const [playerId, count] = Object.entries(counts).sort(([, left], [, right]) => right - left)[0] ?? [];
  return playerId ? `${playerId} (${count})` : "n/a";
};

const percent = (value: number): string => `${Math.round(value * 100)}%`;
const yesNo = (value: boolean): string => value ? "ano" : "ne";
const round = (value: number): number => Math.round(value);
