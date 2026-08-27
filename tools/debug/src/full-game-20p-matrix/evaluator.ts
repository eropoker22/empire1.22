import {
  FULL_GAME_EVALUATION_VERSION,
  FULL_GAME_HARNESS_REVISION,
  type ActionCoverageEntry,
  type FullGameReport,
  type FullGameScenario,
  type RejectionTotals
} from "./types";

export const REQUIRED_SUCCESSFUL_ACTIONS = [
  "upgrade-building",
  "craft-item",
  "collect-production",
  "buy-player-market-listing",
  "create-bounty",
  "create-alliance",
  "spy-district",
  "rob-district",
  "heist-district",
  "attack-district"
] as const;

export interface MatrixEvaluationRequirements {
  requiredSeeds: readonly string[];
  requiredScenarios: readonly FullGameScenario[];
}

export interface GameEvaluation {
  passed: boolean;
  failureCodes: string[];
  rejectionTotals: RejectionTotals;
}

export const emptyRejectionTotals = (): RejectionTotals => ({
  totalRejections: 0,
  expectedGameplayRejections: 0,
  expectedConcurrencyRejections: 0,
  botDecisionErrors: 0,
  realGameBugRejections: 0,
  harnessErrors: 0,
  unclassifiedRejections: 0
});

export const normalizeActionCoverageEntry = (
  value: Partial<ActionCoverageEntry> | undefined
): ActionCoverageEntry => {
  const hasV2Breakdown = value?.expectedGameplayReject !== undefined
    || value?.expectedConcurrencyReject !== undefined
    || value?.botDecisionError !== undefined
    || value?.realGameBug !== undefined
    || value?.harnessError !== undefined
    || value?.unclassifiedUnexpectedReject !== undefined;
  const expectedGameplayReject = integer(hasV2Breakdown ? value?.expectedGameplayReject : value?.expectedReject);
  const expectedConcurrencyReject = integer(value?.expectedConcurrencyReject);
  const botDecisionError = integer(value?.botDecisionError);
  const realGameBug = integer(value?.realGameBug);
  const harnessError = integer(value?.harnessError);
  const unclassifiedUnexpectedReject = integer(
    hasV2Breakdown ? value?.unclassifiedUnexpectedReject : value?.unexpectedFailure
  );
  return {
    executed: integer(value?.executed),
    success: integer(value?.success),
    expectedGameplayReject,
    expectedConcurrencyReject,
    botDecisionError,
    realGameBug,
    harnessError,
    unclassifiedUnexpectedReject,
    expectedReject: expectedGameplayReject + expectedConcurrencyReject,
    unexpectedFailure: botDecisionError + realGameBug + harnessError + unclassifiedUnexpectedReject,
    seeds: Array.isArray(value?.seeds) ? [...new Set(value.seeds.map(String))] : []
  };
};

export const normalizeActionCoverage = (
  coverage: FullGameReport["actionCoverage"] | undefined
): Record<string, ActionCoverageEntry> => Object.fromEntries(
  Object.entries(coverage ?? {}).map(([action, entry]) => [action, normalizeActionCoverageEntry(entry)])
);

export const rejectionTotalsFromCoverage = (
  coverage: Record<string, ActionCoverageEntry>
): RejectionTotals => {
  const totals = emptyRejectionTotals();
  for (const entry of Object.values(coverage)) {
    totals.expectedGameplayRejections += entry.expectedGameplayReject;
    totals.expectedConcurrencyRejections += entry.expectedConcurrencyReject;
    totals.botDecisionErrors += entry.botDecisionError;
    totals.realGameBugRejections += entry.realGameBug;
    totals.harnessErrors += entry.harnessError;
    totals.unclassifiedRejections += entry.unclassifiedUnexpectedReject;
  }
  totals.totalRejections = totals.expectedGameplayRejections
    + totals.expectedConcurrencyRejections
    + totals.botDecisionErrors
    + totals.realGameBugRejections
    + totals.harnessErrors
    + totals.unclassifiedRejections;
  return totals;
};

export const evaluateGameResult = (input: FullGameReport): GameEvaluation => {
  const actionCoverage = normalizeActionCoverage(input.actionCoverage);
  const rejectionTotals = rejectionTotalsFromCoverage(actionCoverage);
  const failureCodes: string[] = [];
  const require = (condition: boolean, code: string): void => {
    if (!condition && !failureCodes.includes(code)) failureCodes.push(code);
  };

  require(input.playersStarted === 20, "PLAYERS_NOT_20");
  require(input.playersFinished === 20, "PLAYERS_NOT_FINISHED");
  require(input.factionsRepresented.length === 8, "FACTIONS_NOT_8");
  for (const action of REQUIRED_SUCCESSFUL_ACTIONS) {
    require((actionCoverage[action]?.success ?? 0) > 0, `ACTION_NOT_SUCCESSFUL:${action}`);
  }
  require(input.marketTrades >= 3, "PLAYER_MARKET_TRADE_COVERAGE_LOW");
  require(input.bountiesClaimed > 0, "BOUNTY_CLAIM_MISSING");
  require((input.cityEventClaimableRewardsObserved ?? 0) === 0
    || (input.cityEventRewardClaims ?? actionCoverage["claim-city-event-reward"]?.success ?? 0) > 0,
  "CITY_EVENT_CLAIMABLE_REWARD_NOT_CLAIMED");
  require(input.policeRaids > 0, "POLICE_RAID_MISSING");
  require(input.cityEvents > 0, "CITY_EVENT_MISSING");
  require(input.playersEliminated > 0, "PURGE_ELIMINATION_MISSING");
  require(input.purgeStarted, "PURGE_START_MISSING");
  require(input.purgeCompleted, "PURGE_COMPLETION_MISSING");
  require(input.finalLockdownStarted, "FINAL_LOCKDOWN_START_MISSING");
  require(input.finalLockdownCompleted, "FINAL_LOCKDOWN_RESOLUTION_MISSING");
  require(Boolean(input.winnerId), "WINNER_MISSING");
  require(input.players.filter((player) => player.winner).length === 1, "WINNER_NOT_UNIQUE");
  require(input.finalResultPersisted, "FINAL_RESULT_NOT_PERSISTED");
  require(input.restartRecoveryVerified, "RESTART_RECOVERY_FAILED");
  require(input.idempotenceVerified, "IDEMPOTENCE_FAILED");
  require(input.concurrencyVerified, "CONCURRENCY_FAILED");
  require(input.postGameMutationBlocked, "POST_GAME_COMMAND_NOT_BLOCKED");
  require(input.postGameTickImmutable, "POST_GAME_TICK_MUTATED");
  require(!(input.stalled ?? input.failureCodes.includes("STALLED_GAME")), "STALLED_GAME");
  require(input.invariantViolations.length === 0, "INVARIANT_VIOLATION");
  require(input.unexpectedErrors.length === 0, "UNEXPECTED_EXCEPTION");
  require(rejectionTotals.botDecisionErrors === 0, "BOT_DECISION_ERROR");
  require(rejectionTotals.realGameBugRejections === 0, "REAL_GAME_BUG_REJECTION");
  require(rejectionTotals.harnessErrors === 0, "HARNESS_ERROR");
  require(rejectionTotals.unclassifiedRejections === 0, "UNCLASSIFIED_UNEXPECTED_REJECTION");

  return { passed: failureCodes.length === 0, failureCodes, rejectionTotals };
};

export const reevaluateGameReport = (stored: FullGameReport): FullGameReport => {
  const actionCoverage = normalizeActionCoverage(stored.actionCoverage);
  const candidate: FullGameReport = { ...stored, actionCoverage };
  const evaluation = evaluateGameResult(candidate);
  return {
    ...candidate,
    passed: evaluation.passed,
    failureCodes: evaluation.failureCodes,
    errors: evaluation.failureCodes.map((message) => ({
      severity: severityFor(message),
      kind: kindFor(message),
      message
    })),
    rejectionTotals: evaluation.rejectionTotals
  };
};

export const evaluateMatrixResult = (
  storedGames: readonly FullGameReport[],
  requirements: MatrixEvaluationRequirements
): { games: FullGameReport[]; verdict: "PASS" | "FAIL"; failureCodes: string[] } => {
  const games = storedGames.map(reevaluateGameReport);
  const failureCodes: string[] = [];
  const require = (condition: boolean, code: string): void => {
    if (!condition && !failureCodes.includes(code)) failureCodes.push(code);
  };
  const seedCounts = new Map<string, number>();
  for (const game of games) seedCounts.set(game.seed, (seedCounts.get(game.seed) ?? 0) + 1);
  require(games.length === requirements.requiredSeeds.length, "MATRIX_GAME_COUNT_MISMATCH");
  require(requirements.requiredSeeds.every((seed) => seedCounts.get(seed) === 1), "MATRIX_REQUIRED_SEEDS_MISSING_OR_DUPLICATE");
  require([...seedCounts.keys()].every((seed) => requirements.requiredSeeds.includes(seed)), "MATRIX_UNEXPECTED_SEED");
  require(requirements.requiredScenarios.every((scenario) => games.some((game) => game.scenario === scenario)), "MATRIX_REQUIRED_SCENARIOS_MISSING");
  require(games.every((game) => game.evaluationVersion === FULL_GAME_EVALUATION_VERSION), "MATRIX_EVALUATION_VERSION_MISMATCH");
  require(games.every((game) => game.harnessRevision === FULL_GAME_HARNESS_REVISION), "MATRIX_HARNESS_REVISION_MISMATCH");
  const sourceRevisions = new Set(games.map((game) => game.sourceRevision).filter(Boolean));
  require(sourceRevisions.size === 1 && games.every((game) => Boolean(game.sourceRevision)), "MATRIX_SOURCE_REVISION_MISMATCH");
  require(games.every((game) => game.passed), "MATRIX_GAME_FAILED");
  const claimableRewardsObserved = games.reduce((sum, game) => sum + (game.cityEventClaimableRewardsObserved ?? 0), 0);
  const rewardsClaimed = games.reduce((sum, game) => sum + (game.cityEventRewardClaims ?? 0), 0);
  require(claimableRewardsObserved === 0 || rewardsClaimed > 0, "MATRIX_CITY_EVENT_CLAIMABLE_REWARD_NOT_CLAIMED");
  return { games, verdict: failureCodes.length === 0 ? "PASS" : "FAIL", failureCodes };
};

const integer = (value: unknown): number => Math.max(0, Math.floor(Number(value) || 0));
const severityFor = (code: string): "P0" | "P1" | "P2" | "P3" =>
  /WINNER|INVARIANT|STALLED|REAL_GAME_BUG/u.test(code) ? "P0" : "P1";
const kindFor = (code: string): "REAL GAME BUG" | "SIMULATION BUG" | "CONFIG ISSUE" =>
  /BOT_DECISION|HARNESS|UNCLASSIFIED|MATRIX_|COVERAGE|ACTION_NOT_SUCCESSFUL/u.test(code)
    ? "SIMULATION BUG"
    : "REAL GAME BUG";
