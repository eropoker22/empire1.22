import { describe, expect, it } from "vitest";
import {
  evaluateGameResult,
  normalizeActionCoverageEntry,
  reevaluateGameReport,
  REQUIRED_SUCCESSFUL_ACTIONS
} from "../../tools/debug/src/full-game-20p-matrix/evaluator";
import { classifyRejection } from "../../tools/debug/src/full-game-20p-matrix/rejection-classification";
import { buildFullGameMatrixReport } from "../../tools/debug/src/full-game-20p-matrix/report";
import {
  FULL_GAME_EVALUATION_VERSION,
  FULL_GAME_HARNESS_REVISION,
  type ActionCoverageEntry,
  type FullGameReport
} from "../../tools/debug/src/full-game-20p-matrix/types";

describe("full-game matrix canonical evaluation", () => {
  it("does not trust stored passed:true when legacy raw coverage contains unexpected failures", () => {
    const stored = passingReport();
    stored.schemaVersion = 1;
    stored.evaluationVersion = undefined;
    stored.harnessRevision = undefined;
    stored.sourceRevision = undefined;
    stored.passed = true;
    stored.failureCodes = [];
    stored.actionCoverage["upgrade-building"] = {
      executed: 2,
      success: 1,
      expectedReject: 0,
      unexpectedFailure: 1,
      seeds: ["1"]
    } as ActionCoverageEntry;

    const evaluated = reevaluateGameReport(stored);

    expect(evaluated.passed).toBe(false);
    expect(evaluated.failureCodes).toContain("UNCLASSIFIED_UNEXPECTED_REJECTION");
    expect(evaluated.rejectionTotals?.unclassifiedRejections).toBe(1);
  });

  it("allows only explicitly classified gameplay and concurrency rejections", () => {
    const stored = passingReport();
    stored.actionCoverage["upgrade-building"] = coverage({ expectedGameplayReject: 2 });
    stored.actionCoverage["buy-player-market-listing"] = coverage({ expectedConcurrencyReject: 1 });

    const evaluated = evaluateGameResult(stored);

    expect(evaluated.passed).toBe(true);
    expect(evaluated.rejectionTotals).toMatchObject({
      totalRejections: 3,
      expectedGameplayRejections: 2,
      expectedConcurrencyRejections: 1,
      unclassifiedRejections: 0
    });
  });

  it("recomputes a stale stored failure from raw passing metrics", () => {
    const stored = passingReport();
    stored.passed = false;
    stored.failureCodes = ["STALE_STORED_FAILURE"];

    const evaluated = reevaluateGameReport(stored);

    expect(evaluated.passed).toBe(true);
    expect(evaluated.failureCodes).toEqual([]);
  });

  it("requires a claim only when a claimable city-event reward was observed", () => {
    const noPendingReward = passingReport();
    noPendingReward.cityEventRewardClaims = 0;
    noPendingReward.cityEventClaimableRewardsObserved = 0;
    expect(evaluateGameResult(noPendingReward).passed).toBe(true);

    const missedClaim = passingReport();
    missedClaim.cityEventRewardClaims = 0;
    missedClaim.cityEventClaimableRewardsObserved = 1;
    expect(evaluateGameResult(missedClaim).failureCodes)
      .toContain("CITY_EVENT_CLAIMABLE_REWARD_NOT_CLAIMED");
  });

  it("recomputes every game and rejects duplicate or missing required seeds", () => {
    const first = passingReport("1");
    const duplicate = passingReport("1");
    duplicate.passed = true;

    const matrix = buildFullGameMatrixReport([first, duplicate], {
      requiredSeeds: ["1", "2"],
      requiredScenarios: ["balanced-city"]
    });

    expect(matrix.verdict).toBe("FAIL");
    expect(matrix.matrixFailureCodes).toContain("MATRIX_REQUIRED_SEEDS_MISSING_OR_DUPLICATE");
  });

  it("rejects aggregation across different executable source fingerprints", () => {
    const first = passingReport("1");
    const second = passingReport("2");
    second.sourceRevision = "different-bundle";

    const matrix = buildFullGameMatrixReport([first, second], {
      requiredSeeds: ["1", "2"],
      requiredScenarios: ["balanced-city"]
    });

    expect(matrix.verdict).toBe("FAIL");
    expect(matrix.matrixFailureCodes).toContain("MATRIX_SOURCE_REVISION_MISMATCH");
  });

  it("classifies by exact canonical code and leaves unknown codes unclassified", () => {
    const expectation = {
      category: "EXPECTED_CONCURRENCY_REJECTION" as const,
      codes: ["server.state_version_conflict"],
      rationale: "Audited stale-state race."
    };

    expect(classifyRejection({ reasonCode: "server.state_version_conflict", expectation }).category)
      .toBe("EXPECTED_CONCURRENCY_REJECTION");
    expect(classifyRejection({ reasonCode: "prefix server.state_version_conflict suffix", expectation }).category)
      .toBe("UNCLASSIFIED_UNEXPECTED_REJECTION");
  });
});

const passingReport = (seed = "1"): FullGameReport => ({
  schemaVersion: 2,
  evaluationVersion: FULL_GAME_EVALUATION_VERSION,
  harnessRevision: FULL_GAME_HARNESS_REVISION,
  sourceRevision: "test-source",
  seed,
  scenario: "balanced-city",
  passed: true,
  failureCodes: [],
  errors: [],
  architecture: [],
  durationTicks: 100,
  durationGameTimeMs: 1000,
  commandsAttempted: REQUIRED_SUCCESSFUL_ACTIONS.length + 2,
  commandsAccepted: REQUIRED_SUCCESSFUL_ACTIONS.length,
  commandsRejected: 2,
  rejectionsByReason: {},
  playersStarted: 20,
  playersEliminated: 12,
  playersFinished: 20,
  factionsRepresented: ["mafian", "kartel", "motorkarsky-gang", "korporace", "kult", "tajna-organizace", "soukroma-armada", "hackeri"],
  alliancesCreated: 1,
  maxAllianceSize: 2,
  districtOwnershipChanges: 1,
  attacks: 1,
  spies: 1,
  robberies: 1,
  heists: 1,
  marketTrades: 3,
  marketVolume: 100,
  bountiesCreated: 1,
  bountiesClaimed: 1,
  cityEventRewardClaims: 1,
  policeRaids: 1,
  cityEvents: 1,
  purgeStarted: true,
  purgeCompleted: true,
  finalLockdownStarted: true,
  finalLockdownCompleted: true,
  winnerId: "player:1",
  finalResultPersisted: true,
  restartRecoveryVerified: true,
  idempotenceVerified: true,
  concurrencyVerified: true,
  postGameMutationBlocked: true,
  postGameTickImmutable: true,
  stalled: false,
  invariantChecks: 100,
  invariantViolations: [],
  unexpectedErrors: [],
  actionCoverage: Object.fromEntries(REQUIRED_SUCCESSFUL_ACTIONS.map((action) => [action, coverage()])),
  players: Array.from({ length: 20 }, (_, index) => ({
    playerId: `player:${index + 1}`,
    faction: "mafian",
    archetype: "balanced",
    startingDistrict: `district:${index + 1}`,
    finalDistrictCount: index === 0 ? 1 : 0,
    maxDistrictCount: 1,
    cleanCashEarned: 0,
    dirtyCashEarned: 0,
    influenceEarned: 0,
    buildingsOwned: 0,
    buildingUpgrades: 0,
    productionStarted: 0,
    productionCompleted: 0,
    marketOffers: 0,
    marketTrades: 0,
    marketVolume: 0,
    bountiesCreated: 0,
    bountiesClaimed: 0,
    bountyValuePaid: 0,
    bountyValueEarned: 0,
    spyAttempts: 0,
    spySuccesses: 0,
    spyFailures: 0,
    robberies: 0,
    heists: 0,
    attacksStarted: 0,
    attacksWon: 0,
    attacksLost: 0,
    districtsCaptured: 0,
    districtsLost: 0,
    heatGenerated: 0,
    maxHeat: 0,
    policeRaids: 0,
    policePenalties: 0,
    allianceJoined: false,
    allianceId: null,
    purgeOutcome: index < 8 ? "survived" : "eliminated",
    finalLockdownOutcome: index === 0 ? "winner" : "lost",
    eliminatedAt: index < 8 ? null : 10,
    eliminationReason: index < 8 ? null : "test",
    finalPlacement: index + 1,
    winner: index === 0
  })),
  traceTail: []
});

const coverage = (overrides: Partial<ActionCoverageEntry> = {}): ActionCoverageEntry =>
  normalizeActionCoverageEntry({ executed: 1, success: 1, seeds: ["1"], ...overrides });
