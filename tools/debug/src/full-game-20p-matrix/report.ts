import type {
  ActionCoverageEntry,
  FullGameMatrixReport,
  FullGameReport,
  FullGameScenario
} from "./types";
import {
  evaluateMatrixResult,
  normalizeActionCoverageEntry,
  rejectionTotalsFromCoverage,
  type MatrixEvaluationRequirements
} from "./evaluator";
import {
  FULL_GAME_EVALUATION_VERSION,
  FULL_GAME_HARNESS_REVISION
} from "./types";

export const buildFullGameMatrixReport = (
  storedGames: FullGameReport[],
  requirements: MatrixEvaluationRequirements = {
    requiredSeeds: storedGames.map((game) => game.seed),
    requiredScenarios: [...new Set(storedGames.map((game) => game.scenario))] as FullGameScenario[]
  }
): FullGameMatrixReport => {
  const evaluation = evaluateMatrixResult(storedGames, requirements);
  const games = evaluation.games;
  const actionCoverage = mergeCoverage(games);
  const rejectionTotals = rejectionTotalsFromCoverage(actionCoverage);
  return {
    schemaVersion: 2,
    evaluationVersion: FULL_GAME_EVALUATION_VERSION,
    harnessRevision: FULL_GAME_HARNESS_REVISION,
    sourceRevision: [...new Set(games.map((game) => game.sourceRevision).filter(Boolean))].join(",") || "missing",
    verdict: evaluation.verdict,
    generatedAt: new Date().toISOString(),
    games,
    matrixFailureCodes: evaluation.failureCodes,
    rejectionTotals,
    totals: {
      games: games.length,
      passed: games.filter((game) => game.passed).length,
      winners: games.filter((game) => game.winnerId).length,
      stalled: games.filter((game) => game.failureCodes.includes("STALLED_GAME")).length,
      commandsAttempted: sum(games, "commandsAttempted"),
      commandsAccepted: sum(games, "commandsAccepted"),
      attacks: sum(games, "attacks"),
      spies: sum(games, "spies"),
      robberies: sum(games, "robberies"),
      heists: sum(games, "heists"),
      marketTrades: sum(games, "marketTrades"),
      bountiesCreated: sum(games, "bountiesCreated"),
      bountiesClaimed: sum(games, "bountiesClaimed"),
      cityEventRewardClaims: sum(games, "cityEventRewardClaims"),
      cityEventClaimableRewardsObserved: sum(games, "cityEventClaimableRewardsObserved"),
      cityEventBlockedRewardsObserved: sum(games, "cityEventBlockedRewardsObserved"),
      policeRaids: sum(games, "policeRaids"),
      cityEvents: sum(games, "cityEvents"),
      eliminations: sum(games, "playersEliminated"),
      ...rejectionTotals
    },
    actionCoverage,
    factionMatrix: aggregatePlayers(games, "faction"),
    archetypeMatrix: aggregatePlayers(games, "archetype")
  };
};

export const formatFullGameMarkdown = (matrix: FullGameMatrixReport): string => {
  const total = matrix.totals;
  const lines = [
    "# Empire Streets Full Game Matrix",
    "",
    `**MATRIX VERDICT: ${matrix.verdict}**`,
    "",
    `Matrix failures: ${matrix.matrixFailureCodes.join(", ") || "none"}.`,
    `Games: ${total.games}; passed: ${total.passed}; legitimate winners: ${total.winners}; stalled: ${total.stalled}.`,
    `Commands: ${total.commandsAttempted} attempted, ${total.commandsAccepted} accepted.`,
    `Rejections: ${matrix.rejectionTotals.totalRejections} total; gameplay ${matrix.rejectionTotals.expectedGameplayRejections}; concurrency ${matrix.rejectionTotals.expectedConcurrencyRejections}; bot ${matrix.rejectionTotals.botDecisionErrors}; game bug ${matrix.rejectionTotals.realGameBugRejections}; harness ${matrix.rejectionTotals.harnessErrors}; unclassified ${matrix.rejectionTotals.unclassifiedRejections}.`,
    "",
    "## Games",
    "",
    "| Seed | Scenario | Verdict | Ticks | Winner | Commands | Failures |",
    "|---|---|---:|---:|---|---:|---|",
    ...matrix.games.map((game) => `| ${game.seed} | ${game.scenario} | ${game.passed ? "PASS" : "FAIL"} | ${game.durationTicks} | ${game.winnerId ?? "none"} | ${game.commandsAttempted} | ${game.failureCodes.join(", ") || "none"} |`),
    "",
    "## Action coverage",
    "",
    "| Action | Attempts | Success | Expected gameplay | Expected concurrency | Bot error | Game bug | Harness | Unclassified | Seeds |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(matrix.actionCoverage).sort(([a], [b]) => a.localeCompare(b)).map(([action, entry]) =>
      `| ${action} | ${entry.executed} | ${entry.success} | ${entry.expectedGameplayReject} | ${entry.expectedConcurrencyReject} | ${entry.botDecisionError} | ${entry.realGameBug} | ${entry.harnessError} | ${entry.unclassifiedUnexpectedReject} | ${entry.seeds.length} |`
    ),
    "",
    "## Lifecycle coverage",
    "",
    `Player-market completed trades: ${total.marketTrades}.`,
    `Bounties: created ${total.bountiesCreated}; claimed/paid ${total.bountiesClaimed}.`,
    `City-event rewards: ${total.cityEventRewardClaims} claimed, ${total.cityEventClaimableRewardsObserved} claimable observed, ${total.cityEventBlockedRewardsObserved} blocked observed.`,
    "",
    "## Faction matrix",
    "",
    formatAggregateTable(matrix.factionMatrix),
    "",
    "## Archetype matrix",
    "",
    formatAggregateTable(matrix.archetypeMatrix),
    "",
    "## Authoritative path",
    "",
    "`gameplay session → gameplaySliceTransport → command ingress → atomic dispatcher → game-core → transactional persistence → projection → durable worker tick → snapshot recovery`",
    ""
  ];
  return lines.join("\n");
};

const mergeCoverage = (games: FullGameReport[]): Record<string, ActionCoverageEntry> => {
  const merged: Record<string, ActionCoverageEntry> = {};
  for (const game of games) for (const [action, entry] of Object.entries(game.actionCoverage)) {
    const normalized = normalizeActionCoverageEntry(entry);
    const target = merged[action] ??= normalizeActionCoverageEntry(undefined);
    target.executed += normalized.executed;
    target.success += normalized.success;
    target.expectedGameplayReject += normalized.expectedGameplayReject;
    target.expectedConcurrencyReject += normalized.expectedConcurrencyReject;
    target.botDecisionError += normalized.botDecisionError;
    target.realGameBug += normalized.realGameBug;
    target.harnessError += normalized.harnessError;
    target.unclassifiedUnexpectedReject += normalized.unclassifiedUnexpectedReject;
    target.expectedReject = target.expectedGameplayReject + target.expectedConcurrencyReject;
    target.unexpectedFailure = target.botDecisionError + target.realGameBug + target.harnessError + target.unclassifiedUnexpectedReject;
    for (const seed of normalized.seeds) if (!target.seeds.includes(seed)) target.seeds.push(seed);
  }
  return merged;
};

const aggregatePlayers = (games: FullGameReport[], key: "faction" | "archetype") => {
  const grouped = new Map<string, FullGameReport["players"]>();
  for (const player of games.flatMap((game) => game.players)) grouped.set(String(player[key]), [...(grouped.get(String(player[key])) ?? []), player]);
  return [...grouped.entries()].map(([id, players]) => ({
    id,
    games: players.length,
    wins: players.filter((player) => player.winner).length,
    averagePlacement: round(players.reduce((sum, player) => sum + player.finalPlacement, 0) / players.length),
    survivalRate: round(players.filter((player) => player.purgeOutcome === "survived").length / players.length),
    averageDistricts: round(players.reduce((sum, player) => sum + player.finalDistrictCount, 0) / players.length),
    averageHeat: round(players.reduce((sum, player) => sum + player.maxHeat, 0) / players.length),
    attacks: players.reduce((sum, player) => sum + player.attacksStarted, 0),
    marketTrades: players.reduce((sum, player) => sum + player.marketTrades, 0),
    bountiesClaimed: players.reduce((sum, player) => sum + player.bountiesClaimed, 0)
  }));
};

const formatAggregateTable = (entries: Array<Record<string, string | number>>): string => [
  "| ID | Samples | Wins | Avg placement | Survival | Avg districts | Avg heat | Attacks | Market trades | Bounties |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ...entries.map((entry) => `| ${entry.id} | ${entry.games} | ${entry.wins} | ${entry.averagePlacement} | ${entry.survivalRate} | ${entry.averageDistricts} | ${entry.averageHeat} | ${entry.attacks} | ${entry.marketTrades} | ${entry.bountiesClaimed} |`)
].join("\n");

const sum = (games: FullGameReport[], key: keyof FullGameReport): number => games.reduce((total, game) => total + Number(game[key] ?? 0), 0);
const round = (value: number): number => Math.round(value * 100) / 100;
