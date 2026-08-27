import type { PlayerFactionId } from "@empire/shared-types";

export const FULL_GAME_ARCHETYPES = [
  "aggressor", "turtle", "economist", "expander", "spymaster", "high-heat-criminal",
  "stealth", "market-trader", "bounty-hunter", "alliance-diplomat", "opportunist", "balanced"
] as const;
export type FullGameArchetype = (typeof FULL_GAME_ARCHETYPES)[number];

export const FULL_GAME_SCENARIOS = [
  "balanced-city", "high-conflict", "economy-heavy", "police-chaos", "alliance-war", "endgame-pressure"
] as const;
export type FullGameScenario = (typeof FULL_GAME_SCENARIOS)[number];

export interface SimulationBot {
  accountId: string;
  playerId: string;
  sessionToken: string;
  factionId: PlayerFactionId;
  archetype: FullGameArchetype;
  startingDistrictId: string | null;
}

export const FULL_GAME_EVALUATION_VERSION = 2 as const;
export const FULL_GAME_HARNESS_REVISION = "full-game-20p-rejection-audit-v2" as const;

export const REJECTION_CATEGORIES = [
  "EXPECTED_GAMEPLAY_REJECTION",
  "EXPECTED_CONCURRENCY_REJECTION",
  "BOT_DECISION_ERROR",
  "REAL_GAME_BUG",
  "HARNESS_ERROR",
  "UNCLASSIFIED_UNEXPECTED_REJECTION"
] as const;
export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

export interface RejectionExpectation {
  category: "EXPECTED_GAMEPLAY_REJECTION" | "EXPECTED_CONCURRENCY_REJECTION";
  codes: readonly string[];
  rationale: string;
}

export interface RejectionAuditEntry {
  tick: number;
  playerId: string;
  archetype: FullGameArchetype;
  action: string;
  reasonCode: string;
  category: RejectionCategory;
  rationale: string;
  target: string | null;
  stateVersionBefore: number;
  stateVersionAfter: number;
  expectedStateVersion: number;
  commandId: string;
  decisionContext: Record<string, unknown>;
}

export interface DecisionSkipEntry {
  tick: number;
  playerId: string;
  action: string;
  reasonCode: string;
}

export interface ActionCoverageEntry {
  executed: number;
  success: number;
  expectedGameplayReject: number;
  expectedConcurrencyReject: number;
  botDecisionError: number;
  realGameBug: number;
  harnessError: number;
  unclassifiedUnexpectedReject: number;
  /** Compatibility total for schema-v1 readers. Derived for schema v2. */
  expectedReject: number;
  /** Compatibility total for schema-v1 readers. Derived for schema v2. */
  unexpectedFailure: number;
  seeds: string[];
}

export interface RejectionTotals {
  totalRejections: number;
  expectedGameplayRejections: number;
  expectedConcurrencyRejections: number;
  botDecisionErrors: number;
  realGameBugRejections: number;
  harnessErrors: number;
  unclassifiedRejections: number;
}

export interface BountyLifecycleCoverage {
  created: number;
  claimed: number;
  paid: number;
  cancelled: number;
  expired: number;
  invalid: number;
}

export interface CommandTraceEntry {
  tick: number;
  playerId: string;
  archetype: FullGameArchetype;
  action: string;
  target: string | null;
  accepted: boolean;
  reason: string | null;
  stateVersion: number;
}

export interface PlayerSimulationMetrics {
  playerId: string;
  faction: PlayerFactionId;
  archetype: FullGameArchetype;
  startingDistrict: string | null;
  finalDistrictCount: number;
  maxDistrictCount: number;
  cleanCashEarned: number;
  dirtyCashEarned: number;
  influenceEarned: number;
  buildingsOwned: number;
  buildingUpgrades: number;
  productionStarted: number;
  productionCompleted: number;
  marketOffers: number;
  marketTrades: number;
  marketVolume: number;
  bountiesCreated: number;
  bountiesClaimed: number;
  bountyValuePaid: number;
  bountyValueEarned: number;
  spyAttempts: number;
  spySuccesses: number;
  spyFailures: number;
  robberies: number;
  heists: number;
  attacksStarted: number;
  attacksWon: number;
  attacksLost: number;
  districtsCaptured: number;
  districtsLost: number;
  heatGenerated: number;
  maxHeat: number;
  policeRaids: number;
  policePenalties: number;
  allianceJoined: boolean;
  allianceId: string | null;
  purgeOutcome: string;
  finalLockdownOutcome: string;
  eliminatedAt: number | null;
  eliminationReason: string | null;
  finalPlacement: number;
  winner: boolean;
}

export interface FullGameReport {
  schemaVersion: 1 | 2;
  evaluationVersion?: number;
  harnessRevision?: string;
  sourceRevision?: string;
  seed: string;
  scenario: FullGameScenario;
  passed: boolean;
  failureCodes: string[];
  errors: Array<{ severity: "P0" | "P1" | "P2" | "P3"; kind: "REAL GAME BUG" | "SIMULATION BUG" | "CONFIG ISSUE"; message: string }>;
  architecture: string[];
  durationTicks: number;
  durationGameTimeMs: number;
  commandsAttempted: number;
  commandsAccepted: number;
  commandsRejected: number;
  rejectionsByReason: Record<string, number>;
  rejectionTotals?: RejectionTotals;
  rejectionAudit?: RejectionAuditEntry[];
  decisionSkips?: DecisionSkipEntry[];
  playersStarted: number;
  playersEliminated: number;
  playersFinished: number;
  factionsRepresented: PlayerFactionId[];
  alliancesCreated: number;
  maxAllianceSize: number;
  districtOwnershipChanges: number;
  attacks: number;
  spies: number;
  robberies: number;
  heists: number;
  marketTrades: number;
  marketVolume: number;
  bountiesCreated: number;
  bountiesClaimed: number;
  bountyLifecycle?: BountyLifecycleCoverage;
  cityEventRewardClaims?: number;
  cityEventClaimableRewardsObserved?: number;
  cityEventBlockedRewardsObserved?: number;
  policeRaids: number;
  cityEvents: number;
  purgeStarted: boolean;
  purgeCompleted: boolean;
  finalLockdownStarted: boolean;
  finalLockdownCompleted: boolean;
  winnerId: string | null;
  finalResultPersisted: boolean;
  restartRecoveryVerified: boolean;
  idempotenceVerified: boolean;
  concurrencyVerified: boolean;
  postGameMutationBlocked: boolean;
  postGameTickImmutable: boolean;
  stalled?: boolean;
  invariantChecks: number;
  invariantViolations: Array<{ tick: number; code: string; entityId: string | null; message: string }>;
  unexpectedErrors: string[];
  actionCoverage: Record<string, ActionCoverageEntry>;
  players: PlayerSimulationMetrics[];
  traceTail: CommandTraceEntry[];
}

export interface FullGameMatrixReport {
  schemaVersion: 2;
  evaluationVersion: number;
  harnessRevision: string;
  sourceRevision: string;
  verdict: "PASS" | "FAIL";
  generatedAt: string;
  games: FullGameReport[];
  matrixFailureCodes: string[];
  rejectionTotals: RejectionTotals;
  totals: Record<string, number>;
  actionCoverage: Record<string, ActionCoverageEntry>;
  factionMatrix: Array<Record<string, string | number>>;
  archetypeMatrix: Array<Record<string, string | number>>;
}
