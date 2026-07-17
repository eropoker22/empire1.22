import { createServerApp, type ServerApp } from "../../../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../../../apps/server/src/bootstrap";
import { enabledSharedCitySpawnDistrictIds } from "../../../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import type { Clock } from "../../../../apps/server/src/runtime/scheduling/clock";
import { createSeededRng, type SeededRng } from "../free-br-simulation/seeded-rng";
import { FACTION_DEFINITIONS, resolveModeConfig } from "@empire/game-config";
import type {
  AttackDistrictCommand,
  BuildingActionView,
  BuyMarketResourceCommand,
  CollectProductionCommand,
  CreateBountyCommand,
  DistrictPanelView,
  GameCommand,
  GameplaySliceView,
  HeistDistrictCommand,
  LoadGameplaySliceRequest,
  MarketResourceId,
  PlaceDefenseCommand,
  PlayerFactionId,
  RunBuildingActionCommand,
  SelectSpawnDistrictCommand,
  SpyDistrictCommand,
  UpgradeBuildingCommand
} from "@empire/shared-types";
import {
  ALLIANCE_CREATE_REQUIRED_INFLUENCE,
  resolvePlayerOperationalLiveness,
  type CoreGameState
} from "@empire/game-core";

declare const process: {
  env: Record<string, string | undefined>;
};

const INSTANCE_ID = "instance:free-closed-alpha-20p";
const DEFAULT_SEED = "empire-closed-alpha-20p";
const DEFAULT_STEPS = 500;
const DEFAULT_PLAYER_COUNT = 20;
const MAX_FACTION_OCCURRENCES = 3;
const BASE_TIME_ISO = "2026-01-01T12:00:00.000Z";

const MATERIAL_RESOURCE_IDS = [
  "chemicals",
  "biomass",
  "stim-pack",
  "metal-parts",
  "tech-core",
  "combat-module",
  "metalParts",
  "techCore",
  "combatModule"
] as const;

const DRUG_RESOURCE_IDS = [
  "neon-dust",
  "pulse-shot",
  "velvet-smoke",
  "ghost-serum",
  "overdrive-x"
] as const;

const MARKET_RESOURCE_IDS: MarketResourceId[] = ["metal-parts", "stim-pack", "chemicals", "biomass"];

const STARTING_BALANCES: Record<string, number> = {
  cash: 5000,
  "dirty-cash": 1000,
  population: 120,
  "gang-members": 120,
  chemicals: 0,
  biomass: 0,
  "stim-pack": 0,
  "metal-parts": 0,
  "tech-core": 0,
  "combat-module": 0,
  metalParts: 0,
  techCore: 0,
  combatModule: 0,
  "neon-dust": 0,
  "pulse-shot": 0,
  "velvet-smoke": 0,
  "ghost-serum": 0,
  "overdrive-x": 0,
  "baseball-bat": 8,
  pistol: 4,
  grenade: 2,
  smg: 2,
  bazooka: 1,
  vest: 4,
  barricades: 4,
  cameras: 2,
  alarm: 2,
  "defense-tower": 1
};

export type BehaviorArchetype =
  | "aggressive_attacker"
  | "defensive_builder"
  | "spy_intelligence"
  | "diplomat_alliance"
  | "bounty_hunter"
  | "economy_optimizer"
  | "balanced_casual"
  | "chaotic"
  | "heat_risk"
  | "special_building_user";

export type ActivityBand = "low" | "medium" | "medium_high" | "high";
export type TargetPreference = "weak" | "wealthy" | "nearby" | "random" | "hostile" | "valuable";
export type SimulationScenario = "mixed" | "conflict-fixture" | "special-coverage";

type ActionKind =
  | "attack"
  | "spy"
  | "alliance"
  | "bounty"
  | "building_action"
  | "collect"
  | "upgrade"
  | "market_buy"
  | "market_sell"
  | "rob"
  | "heist"
  | "occupy"
  | "trap"
  | "defense";

export interface ClosedAlphaSimulationOptions {
  seed?: string;
  steps?: number;
  playerCount?: number;
  scenario?: SimulationScenario;
}

export interface SimulationPlayer {
  id: string;
  name: string;
  factionId: PlayerFactionId;
  behavior: BehaviorArchetype;
  activityBand: ActivityBand;
  activityRate: number;
  riskTolerance: number;
  targetPreference: TargetPreference;
  rngSeed: string;
  sessionToken: string;
  homeDistrictId: string;
}

export interface ResourceSummary {
  cleanCash: number;
  dirtyCash: number;
  influence: number;
  heat: number;
  materials: number;
  population: number;
  rawBalances: Record<string, number>;
  materialBalances: Record<string, number>;
}

export interface ResourceDelta {
  cleanCash: number;
  dirtyCash: number;
  influence: number;
  heat: number;
  materials: number;
  population: number;
  wealth: number;
}

export type RejectionCategory =
  | "insufficient_resources"
  | "cooldown"
  | "invalid_target"
  | "alliance_restriction"
  | "missing_prerequisite"
  | "ownership_issue"
  | "spy_requirement"
  | "bounty_invalid_state"
  | "building_action_unavailable"
  | "duplicate_or_idempotency"
  | "unknown";

export interface CommandAttemptAudit {
  step: number;
  tick: number;
  playerId: string;
  behavior: BehaviorArchetype;
  factionId: PlayerFactionId;
  commandId: string;
  commandType: string;
  actionKind: string;
  accepted: boolean;
  duplicateReplay: boolean;
  expectedRejection: boolean;
  errors: string[];
  rejectionCategories: RejectionCategory[];
  focusDistrictId: string;
  targetDistrictId: string | null;
  targetPlayerId: string | null;
  targetType: string;
  buildingTypeId?: string | null;
  buildingActionId?: string | null;
  resourcesBefore: ResourceSummary;
  resourcesAfter: ResourceSummary;
  resourceDelta: ResourceDelta;
  attackGlobalCooldownUntilTick?: number | null;
}

export interface ActionReadinessResult {
  canSubmit: boolean;
  reasonCode: string;
  missingResource?: string | null;
  requiredAmount?: number | null;
  currentAmount?: number | null;
  missingPrerequisite?: string | null;
  targetProblem?: string | null;
  cooldownRemaining?: number | null;
  plannerAvoidable: boolean;
}

export interface ReadinessSkipAudit {
  step: number;
  playerId: string;
  behavior: BehaviorArchetype;
  factionId: PlayerFactionId;
  actionKind: ActionKind | "probe";
  commandType: string;
  targetDistrictId: string | null;
  targetPlayerId: string | null;
  readiness: ActionReadinessResult;
}

export interface ActionPlanFailure {
  step: number;
  playerId: string;
  behavior: BehaviorArchetype;
  factionId: PlayerFactionId;
  actionKind: ActionKind;
  ownedDistricts: number;
  enabledTargets: number;
  disabledReasonCounts: Record<string, number>;
  influence: number;
  cleanCash: number;
  dirtyCash: number;
}

export interface SpyIntelAudit {
  step: number;
  playerId: string;
  behavior: BehaviorArchetype;
  sourceDistrictId: string;
  targetDistrictId: string;
  targetPlayerId: string | null;
}

export interface FollowUpAttackAudit {
  spyStep: number;
  attackStep: number;
  playerId: string;
  behavior: BehaviorArchetype;
  targetDistrictId: string;
  targetPlayerId: string;
  attackCommandId: string;
}

export interface SpyFollowUpOpportunityAudit {
  id: string;
  playerId: string;
  behavior: BehaviorArchetype;
  targetDistrictId: string;
  targetPlayerId: string;
  sourceDistrictId: string;
  stepCreated: number;
  expiryStep: number;
  confidence: number;
  currentlyValid: boolean;
  status: "open" | "submitted" | "accepted" | "successful" | "blocked" | "expired";
  blockedReason: string | null;
  attackCommandId: string | null;
}

export interface SpecialCoverageAttemptAudit {
  step: number;
  playerId: string;
  buildingTypeId: string;
  actionId: string;
  status: "submitted" | "accepted" | "rejected" | "skipped";
  reasonCode: string | null;
}

export interface BountyAuditRecord {
  bountyId: string;
  createdStep: number;
  creatorPlayerId: string;
  creatorBehavior: BehaviorArchetype;
  targetPlayerId: string;
  targetDistrictId: string | null;
  objectiveType: string;
  rewardCleanCash: number;
  status: string;
  claimedByPlayerId: string | null;
  claimedAtTick: number | null;
  expiresAtTick: number;
}

export interface WealthTimelinePoint {
  step: number;
  tick: number;
  byPlayer: Record<string, number>;
  byBehavior: Record<string, number>;
}

export interface RejectedReasonSummary {
  reason: string;
  category: RejectionCategory;
  count: number;
  percentage: number;
  affectedCommandTypes: string[];
  affectedBehaviors: string[];
  suggestedFix: string;
}

export interface BuildingSpecialActionCoverageRow {
  buildingTypeId: string;
  actionId: string;
  usedCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
  everOwnedRequiredBuilding: boolean;
  availableInRegistry: boolean;
  availableInTransport: boolean;
  consideredByBehaviorEngine: boolean;
  unusedCategory: string | null;
  suggestedReason: string;
}

export interface ClosedAlphaDiagnostics {
  actionReadiness: {
    submittedCommands: number;
    skippedNotReadyActions: number;
    rejectedCommands: number;
    plannerAvoidableRejects: number;
    trueServerRejects: number;
    skipReasons: Record<string, number>;
    skipReasonsByBehavior: Record<string, Record<string, number>>;
    plannerAvoidableRejectReasons: Record<string, number>;
    trueServerRejectReasons: Record<string, number>;
  };
  rejectedCommands: {
    totalRejected: number;
    rejectedRate: number;
    byCommandType: Record<string, number>;
    byBehavior: Record<string, number>;
    byFaction: Record<string, number>;
    byReason: Record<string, number>;
    byCategory: Record<RejectionCategory, number>;
    topReasons: RejectedReasonSummary[];
  };
  alliance: {
    commandsAvailable: {
      createAlliance: boolean;
      joinAlliance: boolean;
      inviteAllianceMember: boolean;
      respondAllianceInvite: boolean;
    };
    requiresInfluence: boolean;
    requiredInfluence: number;
    allianceCreateIntentions: number;
    allianceCreateSkippedNotEnoughInfluence: number;
    allianceCreateSubmitted: number;
    allianceCreateAccepted: number;
    allianceCreateRejected: number;
    allianceReadyButNotSubmitted: number;
    firstAllianceReadyStep: number | null;
    firstAllianceCreatedStep: number | null;
    diplomatAllianceAttempts: number;
    rejectedAllianceCommands: number;
    rejectionReasons: Record<string, number>;
    maxInfluenceByPlayer: Record<string, number>;
    playersEverEligible: string[];
    readinessTimeline: Array<{
      step: number;
      playerId: string;
      behavior: BehaviorArchetype;
      influence: number;
      cleanCash: number;
      meetsInfluenceRequirement: boolean;
      attemptedAllianceAction: boolean;
      result: "accepted" | "rejected" | "not-submitted";
      errors: string[];
      readinessState?: "waiting_for_influence" | "ready" | "submitted" | "blocked";
      estimatedStepsToReady?: number | null;
    }>;
    conclusion: string;
    recommendations: string[];
  };
  conflict: {
    attackPrimaryIntentions: number;
    attackPlanFailures: number;
    attackReadinessSkipped: number;
    attackPlanFailureReasons: Record<string, number>;
    submittedAttacks: number;
    acceptedAttacks: number;
    rejectedAttacks: number;
    successfulAttacks: number;
    rejectedAttackReasons: Record<string, number>;
    spyAuthorizationsCreated: number;
    spyAuthorizationUsedByAttack: number;
    relevantSuccessfulSpies: number;
    followUpAttacksAfterSpy: number;
    spyToAttackConversionRate: number;
    averageStepsBetweenSpyAndAttack: number | null;
    plannedAttackFailureReasons: Record<string, number>;
    conclusion: string;
  };
  bounty: {
    records: BountyAuditRecord[];
    created: number;
    claimed: number;
    claimRate: number;
    unclaimedReasons: Record<string, number>;
    attacksOnPlayersWithBounty: number;
    attacksOnPlayersWithoutBounty: number;
    bountyConflictLift: number | null;
    targetsWithValidAttackPath: number;
    targetsWithoutValidAttackPath: number;
    claimAttemptIntentions: number;
    claimSkippedNoValidAttack: number;
    claimSubmitted: number;
    claimAccepted: number;
    claimRejected: number;
    selfClaimAbuseDetected: boolean;
    conclusion: string;
  };
  bountyOpportunityFunnel: {
    bountyCreated: number;
    bountyTargetsWithValidAttackPath: number;
    bountyTargetsWithoutValidAttackPath: number;
    bountyClaimAttemptIntentions: number;
    bountyClaimSkippedNoValidAttack: number;
    bountyClaimSubmitted: number;
    bountyClaimAccepted: number;
    bountyClaimRejected: number;
    bountyClaimed: number;
    bountyConflictLift: number | null;
    bountyUnclaimedReasons: Record<string, number>;
  };
  buildingSpecialCoverage: {
    totalConfigured: number;
    reachableSpecialActions: number;
    submittedSpecialActions: number;
    acceptedSpecialActions: number;
    rejectedSpecialActions: number;
    trulyUnreachableSpecialActions: number;
    behaviorIgnoredSpecialActions: number;
    usedActions: number;
    unusedActions: number;
    categories: Record<string, number>;
    actions: BuildingSpecialActionCoverageRow[];
  };
  spyFollowUpQueue: {
    spySuccesses: number;
    opportunitiesCreated: number;
    opportunitiesExpired: number;
    attacksSubmitted: number;
    attacksAccepted: number;
    attacksSuccessful: number;
    blockedReasons: Record<string, number>;
    openOpportunities: number;
  };
  snowball: {
    wealthTimeline: WealthTimelinePoint[];
    topSnowballMoments: Array<{ stepFrom: number; stepTo: number; playerId: string; behavior: BehaviorArchetype; wealthDelta: number }>;
    topPlayerBreakdown: {
      playerId: string | null;
      behavior: BehaviorArchetype | null;
      factionId: string | null;
      finalWealth: number;
      heat: number;
      positiveWealthDeltaByCommandType: Record<string, number>;
      positiveWealthDeltaBySource: Record<string, number>;
      cleanCashGainByCommandType: Record<string, number>;
      dirtyCashGainByCommandType: Record<string, number>;
      influenceGainByCommandType: Record<string, number>;
    };
    wealthByBehavior: Record<string, number>;
    wealthGainByPlayerSource: Record<string, Record<string, number>>;
    wealthGainByBehaviorSource: Record<string, Record<string, number>>;
    topIncomeSourcesOverall: Array<{ source: string; amount: number }>;
    topPlayersByNetWealthGain: Array<{ playerId: string; behavior: BehaviorArchetype; factionId: string; netWealthGain: number }>;
    topBehaviorByNetWealthGain: { behavior: string; netWealthGain: number } | null;
    topFactionByNetWealthGain: { factionId: string; netWealthGain: number } | null;
    conclusion: string;
  };
  policeRaids: {
    dayLimit: number;
    nightLimit: number;
    triggered: number;
    resolved: number;
    expired: number;
    pendingFinal: number;
    bySeverity: Record<string, number>;
    byPlayer: Record<string, number>;
    maxOpenPendingRaids: number;
    conclusion: string;
  };
  boost: {
    standaloneCommandFound: boolean;
    commandNames: string[];
    uiOnlyMentions: number;
    buildingOrFactionBoostLikeActions: string[];
    conclusion: string;
    smallestSafeDesign: string[];
  };
}

export interface ClosedAlphaAggregateDiagnostics {
  actionReadiness: {
    submittedCommands: StatSummary;
    skippedNotReadyActions: StatSummary;
    rejectedCommands: StatSummary;
    plannerAvoidableRejects: StatSummary;
    trueServerRejects: StatSummary;
    skipReasons: Record<string, number>;
    plannerAvoidableRejectReasons: Record<string, number>;
    trueServerRejectReasons: Record<string, number>;
  };
  rejectedCommands: {
    byReason: Record<string, number>;
    byCategory: Record<RejectionCategory, number>;
    topReasons: RejectedReasonSummary[];
  };
  alliance: {
    commandsAvailable: ClosedAlphaDiagnostics["alliance"]["commandsAvailable"];
    requiredInfluence: number;
    totalDiplomatAllianceAttempts: number;
    totalRejectedAllianceCommands: number;
    rejectionReasons: Record<string, number>;
    playersEverEligibleBySeed: Record<string, string[]>;
    maxInfluenceObserved: number;
    readinessTimelineSample: Array<ClosedAlphaDiagnostics["alliance"]["readinessTimeline"][number] & { seed: string }>;
    conclusionCounts: Record<string, number>;
    recommendations: string[];
  };
  conflict: {
    attackPrimaryIntentions: number;
    attackPlanFailures: number;
    attackPlanFailureReasons: Record<string, number>;
    submittedAttacks: number;
    acceptedAttacks: number;
    rejectedAttacks: number;
    rejectedAttackReasons: Record<string, number>;
    relevantSuccessfulSpies: number;
    followUpAttacksAfterSpy: number;
    spyToAttackConversionRate: StatSummary;
    averageStepsBetweenSpyAndAttack: StatSummary;
    conclusionCounts: Record<string, number>;
  };
  bounty: {
    created: number;
    claimed: number;
    claimRate: StatSummary;
    unclaimedReasons: Record<string, number>;
    attacksOnPlayersWithBounty: number;
    attacksOnPlayersWithoutBounty: number;
    bountyConflictLift: StatSummary;
    selfClaimAbuseDetectedRuns: number;
    recordsSample: BountyAuditRecord[];
    conclusionCounts: Record<string, number>;
  };
  buildingSpecialCoverage: {
    totalConfigured: number;
    usedActionCount: StatSummary;
    unusedActionCount: StatSummary;
    categories: Record<string, number>;
    actions: Array<{
      buildingTypeId: string;
      actionId: string;
      runsUsed: number;
      runsUnused: number;
      totalUsedCount: number;
      totalRejectedCount: number;
      rejectionReasons: Record<string, number>;
      unusedCategories: Record<string, number>;
      everOwnedRequiredBuildingInAnyRun: boolean;
      availableInRegistryAllRuns: boolean;
      availableInTransportAllRuns: boolean;
      consideredByBehaviorEngineAllRuns: boolean;
      suggestedReason: string;
    }>;
  };
  snowball: {
    topPlayerBreakdowns: Array<ClosedAlphaDiagnostics["snowball"]["topPlayerBreakdown"] & {
      seed: string;
      conclusion: string;
    }>;
    topSnowballMoments: Array<ClosedAlphaDiagnostics["snowball"]["topSnowballMoments"][number] & { seed: string }>;
    wealthByBehavior: Record<string, StatSummary>;
    wealthTimelinePoints: number;
    conclusionCounts: Record<string, number>;
  };
  policeRaids: {
    triggered: StatSummary;
    resolved: StatSummary;
    expired: StatSummary;
    pendingFinal: StatSummary;
    bySeverity: Record<string, number>;
    maxOpenPendingRaids: StatSummary;
    dayLimit: number;
    nightLimit: number;
    conclusionCounts: Record<string, number>;
  };
  boost: ClosedAlphaDiagnostics["boost"];
}

export interface ClosedAlphaMetrics {
  commands: {
    totalSubmitted: number;
    successful: number;
    rejected: number;
    errors: number;
    duplicateOrIdempotent: number;
    payloadConflicts: number;
    expectedRejectionProbes: number;
    averageCommandsPerPlayer: number;
    mostActivePlayer: string | null;
    leastActivePlayer: string | null;
    byType: Record<string, number>;
    rejectedByCode: Record<string, number>;
    byPlayer: Record<string, number>;
    acceptedByPlayer: Record<string, number>;
  };
  combat: {
    attacks: number;
    successfulAttacks: number;
    failedAttacks: number;
    attacksByPlayer: Record<string, number>;
    attacksByFaction: Record<string, number>;
    mostFrequentAttacker: string | null;
    mostFrequentVictim: string | null;
    victimsByPlayer: Record<string, number>;
    attacksOnAllies: number;
    heists: number;
    robs: number;
    occupations: number;
    damageOrLossEvents: number;
    defensePlacements: number;
    alliedDefensePlacements: number;
    trapPlacements: number;
    top1DistrictShare: number;
    top3DistrictShare: number;
    maxConsecutiveCaptureStreak: number;
    averageAttackIntervalTicks: number;
    attackerOccupationLosses: number;
    capturedDefenseTransferViolations: number;
    simultaneousConflictCommands: number;
    offlinePlayerActions: number;
  };
  spying: {
    actions: number;
    success: number;
    partial: number;
    failed: number;
    byPlayer: Record<string, number>;
    targetCounts: Record<string, number>;
    mostFrequentTarget: string | null;
    invalidInformationLeaks: number;
  };
  alliances: {
    createRequests: number;
    joinRequests: number;
    invitesSent: number;
    acceptedInvites: number;
    rejectedInvites: number;
    disbanded: number;
    attacksOnAllies: number;
    activeAlliances: Array<{ allianceId: string; name: string; members: string[] }>;
  };
  bounty: {
    created: number;
    claimed: number;
    expired: number;
    cancelled: number;
    totalValue: number;
    largestBounty: number;
    byCreator: Record<string, number>;
    byTarget: Record<string, number>;
    selfClaimAbuseDetected: boolean;
  };
  buildings: {
    built: number;
    upgrades: number;
    specialActions: number;
    specialActionsByType: Record<string, number>;
    specialActionsByAction: Record<string, number>;
    cooldownViolations: number;
    invalidSpecialAttempts: number;
    mostUsedBuilding: string | null;
    leastUsedBuilding: string | null;
    availableSpecialActions: Array<{ buildingTypeId: string; actionId: string }>;
    unusedSpecialActions: Array<{ buildingTypeId: string; actionId: string }>;
  };
  economy: {
    cleanCashDelta: number;
    dirtyCashDelta: number;
    influenceDelta: number;
    heatDelta: number;
    materialsDelta: number;
    totalStartingWealth: number;
    totalFinalWealth: number;
    averageGrowth: number;
    medianGrowth: number;
    top5ByWealth: Array<{ playerId: string; wealth: number }>;
    bottom5ByWealth: Array<{ playerId: string; wealth: number }>;
    invalidNegativeBalances: Array<{ playerId: string; resourceId: string; amount: number }>;
    marketBuys: number;
    marketSells: number;
    collects: number;
  };
  heatRisk: {
    averageHeat: number;
    maxHeat: number;
    highestHeatPlayer: string | null;
    heatGainByAction: Record<string, number>;
  };
  boost: {
    implemented: boolean;
    uses: number;
    note: string;
  };
  stability: {
    runtimeErrors: number;
    invariantViolations: number;
    invalidStates: number;
    snapshotCommandLogDivergence: number;
    completed: boolean;
  };
  fairness: {
    giniWealth: number;
    topToMedianWealthRatio: number;
    topFactionWealth: { factionId: string; wealth: number } | null;
    bottomFactionWealth: { factionId: string; wealth: number } | null;
    behaviorSuccessRates: Record<string, { submitted: number; accepted: number; successRate: number }>;
    dominantBehaviorWarning: string | null;
    dominantFactionWarning: string | null;
  };
}

export interface ClosedAlphaSimulationReport {
  name: "20-player mixed-behavior closed-alpha simulation";
  passed: boolean;
  config: {
    seed: string;
    steps: number;
    playerCount: number;
    scenario: SimulationScenario;
    tickRateMs: number;
    resourceFieldMapping: Record<string, string>;
    maxFactionOccurrences: number;
  };
  runtime: {
    completed: boolean;
    finalTick: number;
    wallClockMs: number;
  };
  players: Array<Omit<SimulationPlayer, "sessionToken">>;
  factions: {
    availableFactionCount: number;
    requiredFactionCount: number;
    distribution: Record<string, number>;
    maxOccurrence: number;
  };
  initialResources: Record<string, ResourceSummary>;
  finalResources: Record<string, ResourceSummary>;
  liveness: {
    stateCounts: Record<string, number>;
    invalidSoftlocks: number;
    playersWithNoValidOrigin: number;
    playersWithNoFutureDeadline: number;
    defeatedPlayers: number;
    lastStandActivations: number;
    emergencyRecoveryClaims: number;
  };
  metrics: ClosedAlphaMetrics;
  diagnostics: ClosedAlphaDiagnostics;
  warnings: string[];
  errors: string[];
  invariantViolations: string[];
  rawEventCounters: Record<string, number>;
  commandAttemptsSample: CommandAttemptAudit[];
  recommendations: string[];
}

export interface ClosedAlphaSimulationMatrixOptions extends ClosedAlphaSimulationOptions {
  seeds?: number;
  seedList?: string[];
}

export interface StatSummary {
  average: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
}

export interface ClosedAlphaAggregateReport {
  name: "20-player mixed-behavior closed-alpha aggregate simulation";
  passed: boolean;
  config: {
    steps: number;
    playerCount: number;
    scenario: SimulationScenario;
    seeds: string[];
  };
  runtime: {
    wallClockMs: number;
    passCount: number;
    failCount: number;
    invariantViolations: number;
    runtimeErrors: number;
  };
  metrics: Record<string, StatSummary>;
  runSummaries: Array<{
    seed: string;
    passed: boolean;
    totalCommands: number;
    rejectedRate: number;
    attacks: number;
    spyActions: number;
    spyToAttackConversionRate: number;
    bountyCreated: number;
    bountyClaimed: number;
    activeAlliances: number;
    unusedSpecialActions: number;
    gini: number;
    topMedianWealthRatio: number;
    topPlayerByWealth: string | null;
    topBehaviorStyle: string | null;
    topFaction: string | null;
  }>;
  rejectedCommandAggregate: {
    byReason: Record<string, number>;
    byCategory: Record<RejectionCategory, number>;
    topReasons: RejectedReasonSummary[];
  };
  diagnostics: ClosedAlphaAggregateDiagnostics;
  topBehaviorStyles: Record<string, number>;
  topFactions: Record<string, number>;
  reports: ClosedAlphaSimulationReport[];
  recommendations: string[];
}

interface MutableSimulationState {
  server: ServerApp;
  clock: MutableClock;
  rng: SeededRng;
  seed: string;
  steps: number;
  scenario: SimulationScenario;
  players: SimulationPlayer[];
  initialResources: Record<string, ResourceSummary>;
  commandAttempts: CommandAttemptAudit[];
  readinessSkips: ReadinessSkipAudit[];
  sentPayloadByCommandId: Map<string, string>;
  warnings: string[];
  errors: string[];
  invariantViolations: string[];
  unavailableActionsByBehavior: Record<string, number>;
  actionPlanFailures: ActionPlanFailure[];
  primaryActionIntentions: Record<string, number>;
  successfulSpyIntel: SpyIntelAudit[];
  followUpAttackAudits: FollowUpAttackAudit[];
  spyFollowUpOpportunities: SpyFollowUpOpportunityAudit[];
  bountyAuditRecords: BountyAuditRecord[];
  specialCoverageAttempts: SpecialCoverageAttemptAudit[];
  ownedBuildingTypeCountsEver: Record<string, number>;
  wealthTimeline: WealthTimelinePoint[];
  lastCapturePlayerId: string | null;
  currentCaptureStreak: number;
  metrics: ClosedAlphaMetrics;
}

interface PlannedCommand {
  command: GameCommand;
  focusDistrictId: string;
  actionKind: ActionKind | "probe";
  expectedRejection?: boolean;
  targetDistrictId?: string | null;
  targetPlayerId?: string | null;
  readiness?: ActionReadinessResult;
  followUpOpportunityId?: string | null;
  coverageActionKey?: string | null;
}

class MutableClock implements Clock {
  private currentMs: number;

  constructor(startIso: string) {
    this.currentMs = Date.parse(startIso);
  }

  now(): Date {
    return new Date(this.currentMs);
  }

  nowIso(): string {
    return new Date(this.currentMs).toISOString();
  }

  advance(ms: number): void {
    this.currentMs += Math.max(0, Math.floor(ms));
  }
}

export const runClosedAlpha20PlayerSimulation = async (
  options: ClosedAlphaSimulationOptions = {}
): Promise<ClosedAlphaSimulationReport> => {
  const seed = String(options.seed ?? DEFAULT_SEED);
  const steps = Math.max(1, Math.floor(options.steps ?? DEFAULT_STEPS));
  const playerCount = Math.max(1, Math.floor(options.playerCount ?? DEFAULT_PLAYER_COUNT));
  const scenario = normalizeScenario(options.scenario);
  const wallStart = readWallClockMs();
  const clock = new MutableClock(BASE_TIME_ISO);
  const rng = createSeededRng(seed);
  const previousBountyDemoEnv = process.env.EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS;
  process.env.EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS = "0";

  try {
    return await withDeterministicGlobals(rng, clock, async () => {
      const config = resolveModeConfig("free");
      const factionIds = FACTION_DEFINITIONS.map((definition) => definition.id);
      const requiredFactionCount = Math.ceil(playerCount / MAX_FACTION_OCCURRENCES);
      const warnings: string[] = [];
      const errors: string[] = [];
      const invariantViolations: string[] = [];

      if (factionIds.length < requiredFactionCount) {
        const message = [
          `Faction validation failed: ${playerCount} players with max ${MAX_FACTION_OCCURRENCES} per faction require ${requiredFactionCount} factions.`,
          `Project currently exposes ${factionIds.length} factions.`,
          "Smallest fix: add factions to config or lower SIM_PLAYERS / raise the max occurrence limit explicitly."
        ].join(" ");
        return buildEarlyFailureReport({
          seed,
          steps,
          playerCount,
          tickRateMs: config.tickRateMs,
          requiredFactionCount,
          availableFactionCount: factionIds.length,
          errors: [message],
          wallClockMs: readWallClockMs() - wallStart
        });
      }

      if (enabledSharedCitySpawnDistrictIds.length < playerCount) {
        errors.push(`Only ${enabledSharedCitySpawnDistrictIds.length} enabled spawn districts are available for ${playerCount} players.`);
      }

      const server = createServerApp({
        clock,
        environment: {
          NODE_ENV: "test",
          EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS: "0"
        },
        gameplaySessionTokenSecret: "closed-alpha-20p-simulation-secret"
      });
      const players = createSimulationPlayers(seed, playerCount, factionIds, rng);
      const distribution = countBy(players, (player) => player.factionId);
      const maxOccurrence = maxValue(distribution);
      if (maxOccurrence > MAX_FACTION_OCCURRENCES) {
        invariantViolations.push(`Faction occurrence limit failed: max=${maxOccurrence}, limit=${MAX_FACTION_OCCURRENCES}.`);
      }

      const spawnDistrictIds = rng.shuffle(enabledSharedCitySpawnDistrictIds).slice(0, playerCount);
      for (const [index, player] of players.entries()) {
        const spawnDistrictId = spawnDistrictIds[index];
        if (!spawnDistrictId) {
          invariantViolations.push(`Missing spawn district for ${player.id}.`);
          continue;
        }
        const session = await createSimulationSession(server, player, spawnDistrictId, clock);
        player.sessionToken = session.sessionToken;
        player.homeDistrictId = session.homeDistrictId;
      }

      const runtime = getRuntime(server);
      runtime.state.serverInstance.worldSeed = seed;
      normalizeStartingResources(runtime.state, players);
      const initialResources = Object.fromEntries(players.map((player) => [
        player.id,
        summarizePlayerResources(runtime.state, player.id)
      ]));
      validateInitialResources(players, initialResources, invariantViolations);

      const state: MutableSimulationState = {
        server,
        clock,
        rng,
        seed,
        steps,
        scenario,
        players,
        initialResources,
        commandAttempts: [],
        readinessSkips: [],
        sentPayloadByCommandId: new Map(),
        warnings,
        errors,
        invariantViolations,
        unavailableActionsByBehavior: {},
        actionPlanFailures: [],
        primaryActionIntentions: {},
        successfulSpyIntel: [],
        followUpAttackAudits: [],
        spyFollowUpOpportunities: [],
        bountyAuditRecords: [],
        specialCoverageAttempts: [],
        ownedBuildingTypeCountsEver: {},
        wealthTimeline: [],
        lastCapturePlayerId: null,
        currentCaptureStreak: 0,
        metrics: createEmptyMetrics(resolveAvailableBuildingActions(runtime.state))
      };
      configureScenarioWorld(state);
      recordOwnedBuildingTypes(state);
      recordWealthTimeline(state, 0);

      for (let step = 1; step <= steps; step += 1) {
        await runSimulationStep(state, step);
        runTick(state);
        recordOwnedBuildingTypes(state);
        if (step % 25 === 0 || step === steps) {
          recordWealthTimeline(state, step);
        }
        if (step % 25 === 0) {
          validateRuntimeState(state);
        }
      }

      validateRuntimeState(state);
      await runInvariantProbes(state);
      const report = await buildReport(state, readWallClockMs() - wallStart);
      return report;
    });
  } finally {
    if (previousBountyDemoEnv === undefined) {
      delete process.env.EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS;
    } else {
      process.env.EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS = previousBountyDemoEnv;
    }
  }
};

export const runClosedAlpha20PlayerSimulationMatrix = async (
  options: ClosedAlphaSimulationMatrixOptions = {}
): Promise<ClosedAlphaAggregateReport> => {
  const wallStart = readWallClockMs();
  const baseSeed = String(options.seed ?? DEFAULT_SEED);
  const seedList = options.seedList?.length
    ? options.seedList
    : Array.from({ length: Math.max(1, Math.floor(options.seeds ?? 3)) }, (_, index) => `${baseSeed}:matrix:${index + 1}`);
  const steps = Math.max(1, Math.floor(options.steps ?? DEFAULT_STEPS));
  const playerCount = Math.max(1, Math.floor(options.playerCount ?? DEFAULT_PLAYER_COUNT));
  const scenario = normalizeScenario(options.scenario);
  const reports: ClosedAlphaSimulationReport[] = [];

  for (const seed of seedList) {
    reports.push(await runClosedAlpha20PlayerSimulation({
      seed,
      steps,
      playerCount,
      scenario
    }));
  }

  return buildAggregateReport({
    reports,
    steps,
    playerCount,
    scenario,
    wallClockMs: readWallClockMs() - wallStart
  });
};

const createSimulationPlayers = (
  seed: string,
  playerCount: number,
  factionIds: PlayerFactionId[],
  rng: SeededRng
): SimulationPlayer[] => {
  const profiles = createBehaviorProfiles();
  const factionPool = factionIds.flatMap((factionId) =>
    Array.from({ length: MAX_FACTION_OCCURRENCES }, () => factionId)
  );
  const shuffledFactionPool = rng.shuffle(factionPool);

  return Array.from({ length: playerCount }, (_, index) => {
    const profile = profiles[index % profiles.length]!;
    const id = `player_${String(index + 1).padStart(2, "0")}`;
    const factionId = shuffledFactionPool[index]!;
    return {
      id,
      name: `ClosedAlpha ${String(index + 1).padStart(2, "0")}`,
      factionId,
      behavior: profile.behavior,
      activityBand: profile.activityBand,
      activityRate: profile.activityRate,
      riskTolerance: profile.riskTolerance,
      targetPreference: profile.targetPreference,
      rngSeed: `${seed}:${id}:${profile.behavior}`,
      sessionToken: "",
      homeDistrictId: ""
    };
  });
};

const createBehaviorProfiles = (): Array<{
  behavior: BehaviorArchetype;
  activityBand: ActivityBand;
  activityRate: number;
  riskTolerance: number;
  targetPreference: TargetPreference;
}> => [
  { behavior: "aggressive_attacker", activityBand: "high", activityRate: 0.24, riskTolerance: 0.82, targetPreference: "weak" },
  { behavior: "defensive_builder", activityBand: "medium", activityRate: 0.13, riskTolerance: 0.22, targetPreference: "nearby" },
  { behavior: "spy_intelligence", activityBand: "high", activityRate: 0.22, riskTolerance: 0.48, targetPreference: "valuable" },
  { behavior: "diplomat_alliance", activityBand: "medium", activityRate: 0.14, riskTolerance: 0.30, targetPreference: "hostile" },
  { behavior: "bounty_hunter", activityBand: "medium_high", activityRate: 0.18, riskTolerance: 0.64, targetPreference: "wealthy" },
  { behavior: "economy_optimizer", activityBand: "medium", activityRate: 0.15, riskTolerance: 0.28, targetPreference: "valuable" },
  { behavior: "balanced_casual", activityBand: "low", activityRate: 0.08, riskTolerance: 0.45, targetPreference: "nearby" },
  { behavior: "chaotic", activityBand: "high", activityRate: 0.23, riskTolerance: 0.74, targetPreference: "random" },
  { behavior: "heat_risk", activityBand: "high", activityRate: 0.22, riskTolerance: 0.92, targetPreference: "hostile" },
  { behavior: "special_building_user", activityBand: "medium_high", activityRate: 0.17, riskTolerance: 0.55, targetPreference: "valuable" },
  { behavior: "aggressive_attacker", activityBand: "medium_high", activityRate: 0.19, riskTolerance: 0.70, targetPreference: "wealthy" },
  { behavior: "defensive_builder", activityBand: "low", activityRate: 0.09, riskTolerance: 0.18, targetPreference: "nearby" },
  { behavior: "spy_intelligence", activityBand: "medium_high", activityRate: 0.18, riskTolerance: 0.42, targetPreference: "weak" },
  { behavior: "diplomat_alliance", activityBand: "medium_high", activityRate: 0.17, riskTolerance: 0.36, targetPreference: "hostile" },
  { behavior: "bounty_hunter", activityBand: "medium", activityRate: 0.14, riskTolerance: 0.58, targetPreference: "wealthy" },
  { behavior: "economy_optimizer", activityBand: "medium_high", activityRate: 0.18, riskTolerance: 0.35, targetPreference: "valuable" },
  { behavior: "balanced_casual", activityBand: "medium", activityRate: 0.12, riskTolerance: 0.50, targetPreference: "random" },
  { behavior: "chaotic", activityBand: "medium_high", activityRate: 0.18, riskTolerance: 0.80, targetPreference: "random" },
  { behavior: "heat_risk", activityBand: "medium_high", activityRate: 0.18, riskTolerance: 0.88, targetPreference: "hostile" },
  { behavior: "special_building_user", activityBand: "medium", activityRate: 0.14, riskTolerance: 0.52, targetPreference: "valuable" }
];

const createSimulationSession = async (
  server: ServerApp,
  player: SimulationPlayer,
  spawnDistrictId: string,
  clock: MutableClock
): Promise<{ sessionToken: string; homeDistrictId: string }> => {
  const loadRequest: LoadGameplaySliceRequest = {
    serverInstanceId: INSTANCE_ID,
    playerId: player.id,
    preferredStartDistrictId: spawnDistrictId,
    factionId: player.factionId
  };
  const ensureResult = await ensureGameplaySliceSessionResult(server.instanceManager, loadRequest, {
    allowImplicitInstanceCreation: true
  });
  if (!ensureResult.accepted) {
    throw new Error(`Failed to ensure session for ${player.id}: ${ensureResult.errors[0]?.code ?? "unknown"}`);
  }

  const runtime = getRuntime(server);
  const session = await server.gameplaySessionService.createSession({
    registration: {
      id: `simulation-registration:${INSTANCE_ID}:${player.id}`,
      accountId: `simulation:${player.id}`,
      serverInstanceId: INSTANCE_ID,
      playerId: player.id,
      status: "active",
      createdAt: clock.nowIso(),
      version: 1
    },
    nowIso: clock.nowIso(),
    ttlMs: runtime.config.technical.sessionTtlMs
  });
  if (!server.gameplaySessionTokenCodec) {
    throw new Error("Simulation requires gameplay session token codec.");
  }
  const sessionToken = server.gameplaySessionTokenCodec.seal({
    sessionId: session.sessionId,
    accountId: session.accountId,
    serverInstanceId: session.serverInstanceId,
    playerId: session.playerId,
    factionId: player.factionId,
    issuedAt: session.createdAt,
    expiresAt: session.expiresAt,
    version: session.version
  });

  const command = createBaseCommand<SelectSpawnDistrictCommand>(
    player,
    "select-spawn-district",
    `command:${player.id}:select-spawn`,
    { districtId: spawnDistrictId },
    clock
  );
  const response = await server.gameplaySliceTransport.submit({
    sessionToken,
    expectedStateVersion: runtime.state.root.version,
    focusDistrictId: spawnDistrictId,
    command
  });
  if (!response.accepted) {
    throw new Error(`Failed to select spawn for ${player.id}: ${response.errors[0]?.code ?? "unknown"}`);
  }

  return {
    sessionToken,
    homeDistrictId: runtime.state.playersById[player.id]?.homeDistrictId ?? spawnDistrictId
  };
};

const normalizeStartingResources = (state: CoreGameState, players: SimulationPlayer[]): void => {
  for (const playerConfig of players) {
    const player = state.playersById[playerConfig.id];
    if (!player) continue;
    state.playersById[player.id] = {
      ...player,
      name: playerConfig.name,
      factionId: playerConfig.factionId,
      population: STARTING_BALANCES.population,
      version: player.version + 1
    };
    state.resourceStatesById[player.resourceStateId] = {
      id: player.resourceStateId,
      ownerType: "player",
      ownerId: player.id,
      balances: { ...STARTING_BALANCES },
      incomeModifiers: {},
      lastUpdatedTick: state.root.tick,
      version: (state.resourceStatesById[player.resourceStateId]?.version ?? 1) + 1
    };
    const policeState = state.policeStatesById[player.policeStateId];
    if (policeState) {
      state.policeStatesById[player.policeStateId] = {
        ...policeState,
        heat: 0,
        wantedLevel: 0,
        version: policeState.version + 1
      };
    }
  }
  state.root.version += 1;
};

const runSimulationStep = async (state: MutableSimulationState, step: number): Promise<void> => {
  expireSpyFollowUpOpportunities(state, step);

  if (state.scenario === "conflict-fixture" && step === 1) {
    const coveragePlayer = state.players[0];
    const runtime = getRuntime(state.server);
    const intel = Object.values(runtime.state.notificationsById).find((notification) =>
      notification.id === `notification:simulation-occupy-intel:${coveragePlayer?.id}`
    );
    const intelPayload = intel?.payload as { sourceDistrictId?: string; targetDistrictId?: string } | undefined;
    const occupy = coveragePlayer && intelPayload?.sourceDistrictId && intelPayload.targetDistrictId
      ? {
          command: createBaseCommand(coveragePlayer, "occupy-district", commandId(coveragePlayer, "occupy", step), {
            districtId: intelPayload.targetDistrictId,
            sourceDistrictId: intelPayload.sourceDistrictId
          }, state.clock),
          focusDistrictId: intelPayload.sourceDistrictId,
          actionKind: "occupy" as const,
          targetDistrictId: intelPayload.targetDistrictId,
          targetPlayerId: null
        }
      : null;
    if (coveragePlayer && occupy) await submitPlannedCommand(state, coveragePlayer, occupy, step);
  }

  if (state.scenario === "special-coverage") {
    await runSpecialCoverageStep(state, step);
    if (step % 40 === 0) {
      const probePlayer = state.players[(step / 40) % state.players.length]!;
      await submitNegativeProbe(state, probePlayer, step);
    }
    return;
  }

  const activePlayers = state.rng.shuffle(state.players.filter((player) =>
    state.server.instanceManager.getInstanceById(INSTANCE_ID)?.state.playersById[player.id]?.status === "active"
  ));

  for (const player of activePlayers) {
    if (!state.rng.chance(player.activityRate)) continue;
    const planned = planPlayerCommand(state, player, step);
    if (!planned) {
      increment(state.unavailableActionsByBehavior, player.behavior);
      continue;
    }

    await submitPlannedCommand(state, player, planned, step);
  }

  if (step % 40 === 0) {
    const probePlayer = state.players[(step / 40) % state.players.length]!;
    await submitNegativeProbe(state, probePlayer, step);
  }
};

const planPlayerCommand = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  step: number
): PlannedCommand | null => {
  const followUp = planSpyFollowUpAttack(state, player, step);
  if (followUp) return followUp;

  const primary = chooseActionKind(state.rng, player.behavior);
  increment(state.primaryActionIntentions, primary);
  const primaryPlan = planReadyActionKind(state, player, primary, step);
  if (primaryPlan) return primaryPlan;
  recordActionPlanFailure(state, player, primary, step);

  const fallbackOrder = Array.from(new Set<ActionKind>([
    "spy",
    "building_action",
    "collect",
    "market_buy",
    "upgrade",
    "alliance",
    "bounty",
    "rob",
    "heist",
    "attack",
    "occupy",
    "trap",
    "defense",
    "market_sell"
  ]));

  for (const kind of fallbackOrder) {
    const planned = planReadyActionKind(state, player, kind, step);
    if (planned) return planned;
  }

  return null;
};

const planReadyActionKind = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  kind: ActionKind,
  step: number
): PlannedCommand | null => {
  const planned = planActionKind(state, player, kind, step);
  if (!planned) return null;
  const readiness = evaluatePlannedCommandReadiness(state, player, planned);
  if (!readiness.canSubmit) {
    recordReadinessSkip(state, player, planned, step, readiness);
    return null;
  }
  return { ...planned, readiness };
};

const chooseActionKind = (rng: SeededRng, behavior: BehaviorArchetype): ActionKind => {
  const weights: Record<BehaviorArchetype, Partial<Record<ActionKind, number>>> = {
    aggressive_attacker: { attack: 34, spy: 19, heist: 12, rob: 9, building_action: 8, bounty: 6, market_buy: 4, trap: 4, defense: 4 },
    defensive_builder: { defense: 24, building_action: 19, upgrade: 17, collect: 14, trap: 10, market_buy: 7, alliance: 6, spy: 3 },
    spy_intelligence: { spy: 48, attack: 12, heist: 10, bounty: 8, building_action: 8, alliance: 7, rob: 7 },
    diplomat_alliance: { alliance: 35, defense: 12, spy: 14, building_action: 11, collect: 9, bounty: 7, market_buy: 6, attack: 3, heist: 3 },
    bounty_hunter: { bounty: 32, spy: 18, attack: 18, heist: 10, rob: 8, building_action: 7, market_buy: 7 },
    economy_optimizer: { collect: 22, building_action: 25, upgrade: 18, market_buy: 16, market_sell: 8, occupy: 6, spy: 5 },
    balanced_casual: { spy: 16, attack: 13, building_action: 14, collect: 14, market_buy: 9, alliance: 9, defense: 8, bounty: 6, upgrade: 6, rob: 5 },
    chaotic: { spy: 14, attack: 14, building_action: 14, collect: 9, market_buy: 10, market_sell: 5, alliance: 8, bounty: 8, rob: 7, heist: 7, trap: 4 },
    heat_risk: { heist: 24, rob: 20, attack: 18, market_buy: 12, building_action: 12, spy: 8, bounty: 6 },
    special_building_user: { building_action: 46, collect: 12, market_buy: 10, upgrade: 10, spy: 8, alliance: 6, bounty: 4, attack: 4 }
  };
  return rng.weightedPick(weights[behavior]);
};

const planActionKind = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  kind: ActionKind,
  step: number
): PlannedCommand | null => {
  switch (kind) {
    case "spy":
      return planSpy(state, player, step);
    case "attack":
      return planAttack(state, player, step);
    case "rob":
      return planRob(state, player, step);
    case "heist":
      return planHeist(state, player, step);
    case "occupy":
      return planOccupy(state, player, step);
    case "trap":
      return planTrap(state, player, step);
    case "defense":
      return planDefense(state, player, step);
    case "building_action":
      return planBuildingAction(state, player, step);
    case "collect":
      return planCollect(state, player, step);
    case "upgrade":
      return planUpgrade(state, player, step);
    case "market_buy":
      return planMarketBuy(state, player, step);
    case "market_sell":
      return planMarketSell(state, player, step);
    case "alliance":
      return planAlliance(state, player, step);
    case "bounty":
      return planBounty(state, player, step);
    default:
      return null;
  }
};

const planSpy = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const candidates = getOwnedDistrictPanels(state, player)
    .flatMap(({ panel }) => panel.spyTargets
      .filter((target) => target.enabled)
      .map((target) => ({ panel, target })));
  const candidate = chooseTargetCandidate(state, player, candidates, (item) => item.target.ownerPlayerId);
  if (!candidate) return null;

  return {
    command: createBaseCommand(player, "spy-district", commandId(player, "spy", step), {
      districtId: candidate.target.districtId,
      sourceDistrictId: candidate.panel.districtId
    }, state.clock),
    focusDistrictId: candidate.panel.districtId,
    actionKind: "spy",
    targetDistrictId: candidate.target.districtId,
    targetPlayerId: candidate.target.ownerPlayerId
  };
};

const planAttack = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const candidates = getOwnedDistrictPanels(state, player)
    .flatMap(({ panel }) => panel.attackTargets
      .filter((target) => target.enabled)
      .map((target) => ({ panel, target })));
  const candidate = chooseTargetCandidate(state, player, candidates, (item) => item.target.ownerPlayerId);
  if (!candidate) return null;

  return {
    command: createBaseCommand<AttackDistrictCommand>(player, "attack-district", commandId(player, "attack", step), {
      districtId: candidate.target.districtId,
      sourceDistrictId: candidate.panel.districtId,
      weapons: { ...(candidate.target.selectedLoadout ?? {}) },
      expectedConflictRevision: candidate.target.expectedConflictRevision,
      expectedSourceVersion: candidate.target.expectedSourceVersion,
      expectedTargetVersion: candidate.target.expectedTargetVersion
    }, state.clock),
    focusDistrictId: candidate.panel.districtId,
    actionKind: "attack",
    targetDistrictId: candidate.target.districtId,
    targetPlayerId: candidate.target.ownerPlayerId
  };
};

const planRob = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const candidates = getOwnedDistrictPanels(state, player)
    .flatMap(({ panel }) => (panel.robTargets ?? [])
      .filter((target) => target.enabled)
      .map((target) => ({ panel, target })));
  const candidate = chooseTargetCandidate(state, player, candidates, (item) => item.target.ownerPlayerId);
  if (!candidate) return null;

  return {
    command: createBaseCommand(player, "rob-district", commandId(player, "rob", step), {
      targetDistrictId: candidate.target.districtId,
      sourceDistrictId: candidate.panel.districtId,
      expectedTargetVersion: candidate.target.expectedTargetVersion,
      expectedSourceVersion: candidate.target.expectedSourceVersion,
      expectedConflictRevision: candidate.target.expectedConflictRevision
    }, state.clock),
    focusDistrictId: candidate.panel.districtId,
    actionKind: "rob",
    targetDistrictId: candidate.target.districtId,
    targetPlayerId: candidate.target.ownerPlayerId
  };
};

const planHeist = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const candidates = getOwnedDistrictPanels(state, player)
    .flatMap(({ panel }) => (panel.heistTargets ?? [])
      .filter((target) => target.enabled)
      .map((target) => ({ panel, target })));
  const candidate = chooseTargetCandidate(state, player, candidates, (item) => item.target.ownerPlayerId);
  if (!candidate) return null;
  const style = player.riskTolerance > 0.75 ? "all_in" : player.riskTolerance < 0.35 ? "stealth" : "balanced";
  const styleView = candidate.target.styles.find((item) => item.style === style) ?? candidate.target.styles[0];
  const population = summarizePlayerResources(getRuntime(state.server).state, player.id).population;
  const gangMembersSent = Math.max(1, Math.min(styleView?.defaultGangMembersSent ?? 1, Math.floor(population / 4) || 1));

  return {
    command: createBaseCommand<HeistDistrictCommand>(player, "heist-district", commandId(player, "heist", step), {
      targetDistrictId: candidate.target.districtId,
      sourceDistrictId: candidate.panel.districtId,
      style,
      gangMembersSent,
      expectedConflictRevision: candidate.target.expectedConflictRevision,
      expectedTargetVersion: candidate.target.expectedTargetVersion,
      expectedSourceVersion: candidate.target.expectedSourceVersion
    }, state.clock),
    focusDistrictId: candidate.panel.districtId,
    actionKind: "heist",
    targetDistrictId: candidate.target.districtId,
    targetPlayerId: candidate.target.ownerPlayerId
  };
};

const planOccupy = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const candidates = getOwnedDistrictPanels(state, player)
    .flatMap(({ panel }) => panel.occupyTargets
      .filter((target) => target.enabled)
      .map((target) => ({ panel, target })));
  const candidate = state.rng.shuffle(candidates)[0];
  if (!candidate) return null;

  return {
    command: createBaseCommand(player, "occupy-district", commandId(player, "occupy", step), {
      districtId: candidate.target.districtId,
      sourceDistrictId: candidate.panel.districtId,
      expectedConflictRevision: candidate.target.expectedConflictRevision
    }, state.clock),
    focusDistrictId: candidate.panel.districtId,
    actionKind: "occupy",
    targetDistrictId: candidate.target.districtId,
    targetPlayerId: candidate.target.ownerPlayerId
  };
};

const planTrap = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const panel = getOwnedDistrictPanels(state, player).find((candidate) => candidate.panel.trap?.enabled)?.panel;
  if (!panel) return null;
  return {
    command: createBaseCommand(player, "place-trap", commandId(player, "trap", step), {
      districtId: panel.districtId
    }, state.clock),
    focusDistrictId: panel.districtId,
    actionKind: "trap",
    targetDistrictId: panel.districtId,
    targetPlayerId: player.id
  };
};

const planDefense = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const runtime = getRuntime(state.server).state;
  const actor = runtime.playersById[player.id];
  const resourceState = runtime.resourceStatesById[actor?.resourceStateId ?? ""];
  const defenseItemId = (["barricades", "vest", "cameras", "alarm", "defense-tower"] as const)
    .find((itemId) => Number(resourceState?.balances[itemId] ?? 0) >= 1);
  if (!defenseItemId) return null;

  const panels = Object.values(runtime.districtsById)
    .filter((district) => {
      const owner = district.ownerPlayerId ? runtime.playersById[district.ownerPlayerId] : null;
      return district.status !== "destroyed"
        && (district.ownerPlayerId === player.id
          || Boolean(actor?.allianceId && owner?.allianceId === actor.allianceId));
    })
    .map((district) => state.server.instanceManager.getGameplaySliceProjection(
      INSTANCE_ID,
      player.id,
      district.id
    ) as GameplaySliceView | undefined)
    .map((slice) => slice?.district ?? null)
    .filter((panel): panel is DistrictPanelView => Boolean(
      panel?.placeDefense?.enabled
      && panel.placeDefense.usedCapacityPoints < panel.placeDefense.maxCapacityPoints
    ));
  const alliedPanel = panels.find((candidate) => candidate.ownerPlayerId !== player.id);
  const panel = alliedPanel ?? state.rng.shuffle(panels)[0];
  if (!panel?.placeDefense) return null;

  return {
    command: createBaseCommand<PlaceDefenseCommand>(player, "place-defense", commandId(player, "defense", step), {
      targetDistrictId: panel.districtId,
      defenseItemId,
      amount: 1,
      expectedTargetVersion: panel.placeDefense.expectedTargetVersion
    }, state.clock),
    focusDistrictId: panel.districtId,
    actionKind: "defense",
    targetDistrictId: panel.districtId,
    targetPlayerId: panel.ownerPlayerId
  };
};

const planBuildingAction = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const actionCandidates = getOwnedDistrictPanels(state, player).flatMap(({ panel, slice }) =>
    panel.buildings.flatMap((building) =>
      building.actions
        .filter((action) => action.enabled && action.status === "available")
        .map((action) => ({ panel, slice, buildingId: building.buildingId, buildingTypeId: building.buildingTypeId, action }))
    )
  );
  const candidate = state.rng.shuffle(actionCandidates)[0];
  if (!candidate) return null;
  const input = resolveBuildingActionInput(candidate.action, candidate.panel, candidate.slice, state, player);
  if (!input) return null;

  return {
    command: createBaseCommand<RunBuildingActionCommand>(player, "run-building-action", commandId(player, "building-action", step), {
      districtId: candidate.panel.districtId,
      buildingId: candidate.buildingId,
      actionId: candidate.action.actionId,
      ...input
    }, state.clock),
    focusDistrictId: candidate.panel.districtId,
    actionKind: "building_action",
    targetDistrictId: candidate.panel.districtId,
    targetPlayerId: player.id
  };
};

const planCollect = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const candidate = getOwnedDistrictPanels(state, player)
    .flatMap(({ panel }) => panel.slots
      .filter((slot) => slot.buildingId && slot.production?.canCollect)
      .map((slot) => ({ panel, slot })))
    [0];
  if (!candidate?.slot.buildingId) return null;
  return {
    command: createBaseCommand<CollectProductionCommand>(player, "collect-production", commandId(player, "collect", step), {
      districtId: candidate.panel.districtId,
      buildingId: candidate.slot.buildingId
    }, state.clock),
    focusDistrictId: candidate.panel.districtId,
    actionKind: "collect",
    targetDistrictId: candidate.panel.districtId,
    targetPlayerId: player.id
  };
};

const planUpgrade = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const candidate = state.rng.shuffle(getOwnedDistrictPanels(state, player).flatMap(({ panel }) =>
    panel.buildings
      .filter((building) => building.status === "active")
      .map((building) => ({ panel, building }))
  ))[0];
  if (!candidate) return null;
  return {
    command: createBaseCommand<UpgradeBuildingCommand>(player, "upgrade-building", commandId(player, "upgrade", step), {
      districtId: candidate.panel.districtId,
      buildingId: candidate.building.buildingId
    }, state.clock),
    focusDistrictId: candidate.panel.districtId,
    actionKind: "upgrade",
    targetDistrictId: candidate.panel.districtId,
    targetPlayerId: player.id
  };
};

const planMarketBuy = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const focusDistrictId = firstOwnedDistrictId(getRuntime(state.server).state, player.id);
  if (!focusDistrictId) return null;
  const resourceId = state.rng.pick(MARKET_RESOURCE_IDS);
  const paymentType = player.behavior === "heat_risk" && state.rng.chance(0.45) ? "dirtyCash" : "cleanCash";
  const marketType = paymentType === "dirtyCash" || state.rng.chance(player.riskTolerance * 0.25) ? "black" : "normal";
  return {
    command: createBaseCommand<BuyMarketResourceCommand>(player, "buy-market-resource", commandId(player, "market-buy", step), {
      resourceId,
      amount: 1,
      marketType,
      paymentType
    }, state.clock),
    focusDistrictId,
    actionKind: "market_buy",
    targetDistrictId: focusDistrictId,
    targetPlayerId: player.id
  };
};

const planMarketSell = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const focusDistrictId = firstOwnedDistrictId(getRuntime(state.server).state, player.id);
  if (!focusDistrictId) return null;
  const balances = summarizePlayerResources(getRuntime(state.server).state, player.id).rawBalances;
  const sellable = MARKET_RESOURCE_IDS.filter((resourceId) => Math.floor(Number(balances[resourceId] || 0)) > 0);
  if (sellable.length === 0) return null;
  const resourceId = state.rng.pick(sellable);
  return {
    command: createBaseCommand(player, "sell-market-resource", commandId(player, "market-sell", step), {
      resourceId,
      amount: 1
    }, state.clock),
    focusDistrictId,
    actionKind: "market_sell",
    targetDistrictId: focusDistrictId,
    targetPlayerId: player.id
  };
};

const planAlliance = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const runtimeState = getRuntime(state.server).state;
  const focusDistrictId = firstOwnedDistrictId(runtimeState, player.id);
  if (!focusDistrictId) return null;
  const currentPlayer = runtimeState.playersById[player.id];
  if (!currentPlayer) return null;

  const incomingInvite = Object.values(runtimeState.allianceInvitesById ?? {}).find((invite) =>
    invite.targetPlayerId === player.id && invite.status === "pending"
  );
  if (incomingInvite) {
    return {
      command: createBaseCommand(player, "respond-alliance-invite", commandId(player, "alliance-respond", step), {
        inviteId: incomingInvite.id,
        response: state.rng.chance(0.82) ? "accept" : "reject"
      }, state.clock),
      focusDistrictId,
      actionKind: "alliance",
      targetDistrictId: focusDistrictId,
      targetPlayerId: player.id
    };
  }

  if (currentPlayer.allianceId) {
    const alliance = runtimeState.alliancesById[currentPlayer.allianceId];
    if (!alliance || alliance.ownerPlayerId !== player.id) return null;
    const target = state.rng.shuffle(state.players).find((candidate) =>
      candidate.id !== player.id && !runtimeState.playersById[candidate.id]?.allianceId
    );
    if (!target) return null;
    return {
      command: createBaseCommand(player, "invite-alliance-member", commandId(player, "alliance-invite", step), {
        allianceId: alliance.id,
        targetPlayerId: target.id
      }, state.clock),
      focusDistrictId,
      actionKind: "alliance",
      targetDistrictId: focusDistrictId,
      targetPlayerId: target.id
    };
  }

  const joinableAlliance = state.rng.shuffle(Object.values(runtimeState.alliancesById)).find((alliance) =>
    alliance.status === "active" && alliance.memberIds.length < getRuntime(state.server).config.balance.maxAllianceSize
  );
  if (joinableAlliance && state.rng.chance(0.58)) {
    return {
      command: createBaseCommand(player, "join-alliance", commandId(player, "alliance-join", step), {
        allianceId: joinableAlliance.id
      }, state.clock),
      focusDistrictId,
      actionKind: "alliance",
      targetDistrictId: focusDistrictId,
      targetPlayerId: joinableAlliance.ownerPlayerId
    };
  }

  return {
    command: createBaseCommand(player, "create-alliance", commandId(player, "alliance-create", step), {
      name: `${player.name} Pact`,
      tag: `P${player.id.slice(-2)}`,
      emblemColor: factionColor(player.factionId)
    }, state.clock),
    focusDistrictId,
    actionKind: "alliance",
    targetDistrictId: focusDistrictId,
    targetPlayerId: player.id
  };
};

const planBounty = (state: MutableSimulationState, player: SimulationPlayer, step: number): PlannedCommand | null => {
  const runtimeState = getRuntime(state.server).state;
  const focusDistrictId = firstOwnedDistrictId(runtimeState, player.id);
  if (!focusDistrictId) return null;
  const possibleTargets = state.players.filter((candidate) =>
    candidate.id !== player.id && Boolean(firstOwnedDistrictId(runtimeState, candidate.id))
  );
  const targetsWithPath = possibleTargets.filter((candidate) => hasValidAttackPath(state, player.id, candidate.id));
  const target = chooseTargetPlayer(state, player, targetsWithPath.length ? targetsWithPath : possibleTargets);
  if (!target) return null;
  const targetDistrictId = firstOwnedDistrictId(runtimeState, target.id);
  if (!targetDistrictId) return null;
  return {
    command: createBaseCommand<CreateBountyCommand>(player, "create-bounty", commandId(player, "bounty", step), {
      targetPlayerId: target.id,
      objectiveType: "attack-district",
      targetDistrictId,
      rewardCleanCash: 5000,
      durationHours: state.rng.pick([1, 6, 12, 24] as const),
      isAnonymous: state.rng.chance(0.25)
    }, state.clock),
    focusDistrictId,
    actionKind: "bounty",
    targetDistrictId,
    targetPlayerId: target.id
  };
};

const evaluatePlannedCommandReadiness = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  planned: PlannedCommand
): ActionReadinessResult => {
  if (planned.expectedRejection) return ready("expected_probe");
  const runtimeState = getRuntime(state.server).state;
  const resources = summarizePlayerResources(runtimeState, player.id);
  const command = planned.command;

  switch (command.type) {
    case "create-alliance": {
      if (resources.influence < ALLIANCE_CREATE_REQUIRED_INFLUENCE) {
        return notReady({
          reasonCode: "alliance.waiting_for_influence",
          missingResource: "influence",
          requiredAmount: ALLIANCE_CREATE_REQUIRED_INFLUENCE,
          currentAmount: resources.influence,
          plannerAvoidable: true
        });
      }
      break;
    }
    case "create-bounty": {
      const reward = Number((command.payload as CreateBountyCommand["payload"]).rewardCleanCash || 0);
      if (resources.cleanCash < reward) {
        return notReady({
          reasonCode: "bounty.insufficient_clean_cash",
          missingResource: "cleanCash",
          requiredAmount: reward,
          currentAmount: resources.cleanCash,
          plannerAvoidable: true
        });
      }
      if (planned.targetPlayerId === player.id) {
        return notReady({
          reasonCode: "bounty.self_target",
          targetProblem: "self_target",
          plannerAvoidable: true
        });
      }
      break;
    }
    case "buy-market-resource": {
      const payload = command.payload as BuyMarketResourceCommand["payload"];
      const paymentResource = payload.paymentType === "dirtyCash" ? "dirtyCash" : "cleanCash";
      const currentAmount = paymentResource === "dirtyCash" ? resources.dirtyCash : resources.cleanCash;
      if (currentAmount <= 0) {
        return notReady({
          reasonCode: "market.not_enough_cash",
          missingResource: paymentResource,
          requiredAmount: 1,
          currentAmount,
          plannerAvoidable: true
        });
      }
      break;
    }
    case "attack-district": {
      const payload = command.payload as AttackDistrictCommand["payload"];
      const target = findAttackTargetView(state, player.id, payload.sourceDistrictId ?? undefined, payload.districtId);
      const playerState = runtimeState.playersById[player.id];
      if (sumRecord(playerState?.attackLoadout ?? {}) <= 0) {
        return notReady({
          reasonCode: "attack.no_attack_weapons",
          missingPrerequisite: "attack_loadout",
          plannerAvoidable: true
        });
      }
      if (!target) {
        return notReady({
          reasonCode: "attack.target_not_in_frontier",
          targetProblem: "no_frontier_target",
          plannerAvoidable: true
        });
      }
      if (!target.enabled) {
        return notReady({
          reasonCode: attackReadinessReason(target.disabledReason),
          targetProblem: target.disabledReason ?? "attack_disabled",
          cooldownRemaining: target.cooldownRemainingTicks ?? null,
          plannerAvoidable: isPlannerAvoidableTargetReason(target.disabledReason)
        });
      }
      break;
    }
    case "spy-district": {
      const payload = command.payload as SpyDistrictCommand["payload"];
      const target = findSpyTargetView(state, player.id, payload.sourceDistrictId ?? undefined, payload.districtId);
      if (!target) {
        return notReady({
          reasonCode: "spy.target_not_in_frontier",
          targetProblem: "no_frontier_target",
          plannerAvoidable: true
        });
      }
      if (!target.enabled) {
        return notReady({
          reasonCode: spyReadinessReason(target.disabledReason),
          targetProblem: target.disabledReason ?? "spy_disabled",
          plannerAvoidable: isPlannerAvoidableTargetReason(target.disabledReason)
        });
      }
      break;
    }
    case "run-building-action": {
      const payload = command.payload as RunBuildingActionCommand["payload"];
      const action = findBuildingActionView(state, player.id, payload.districtId, payload.buildingId, payload.actionId);
      if (!action) {
        return notReady({
          reasonCode: "building_action.unavailable",
          missingPrerequisite: "building_action_view",
          plannerAvoidable: true
        });
      }
      if (action.status === "cooldown" || (action.cooldownRemainingTicks ?? 0) > 0) {
        return notReady({
          reasonCode: "building_action.cooldown",
          cooldownRemaining: action.cooldownRemainingTicks ?? null,
          plannerAvoidable: true
        });
      }
      if (!action.enabled || action.status !== "available") {
        return notReady({
          reasonCode: "building_action.not_available",
          missingPrerequisite: action.disabledReason ?? action.blockedReason ?? action.phaseBlockedReason ?? action.status,
          plannerAvoidable: true
        });
      }
      const missing = firstMissingResource(resources.rawBalances, action.effectiveInputCost ?? action.inputCost ?? action.cost ?? {});
      if (missing) {
        return notReady({
          reasonCode: "building_action.insufficient_resources",
          missingResource: missing.resourceId,
          requiredAmount: missing.requiredAmount,
          currentAmount: missing.currentAmount,
          plannerAvoidable: true
        });
      }
      break;
    }
    default:
      break;
  }

  return ready("ready");
};

const ready = (reasonCode: string): ActionReadinessResult => ({
  canSubmit: true,
  reasonCode,
  plannerAvoidable: false
});

const notReady = (input: Omit<ActionReadinessResult, "canSubmit">): ActionReadinessResult => ({
  canSubmit: false,
  ...input
});

const recordReadinessSkip = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  planned: PlannedCommand,
  step: number,
  readiness: ActionReadinessResult
): void => {
  state.readinessSkips.push({
    step,
    playerId: player.id,
    behavior: player.behavior,
    factionId: player.factionId,
    actionKind: planned.actionKind,
    commandType: planned.command.type,
    targetDistrictId: planned.targetDistrictId ?? null,
    targetPlayerId: planned.targetPlayerId ?? null,
    readiness
  });
};

const planSpyFollowUpAttack = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  step: number
): PlannedCommand | null => {
  if (!["aggressive_attacker", "bounty_hunter", "spy_intelligence", "heat_risk", "chaotic"].includes(player.behavior)) {
    return null;
  }
  const priorityChance: Record<string, number> = {
    aggressive_attacker: state.scenario === "conflict-fixture" ? 0.78 : 0.42,
    bounty_hunter: state.scenario === "conflict-fixture" ? 0.68 : 0.36,
    spy_intelligence: 0.22,
    heat_risk: 0.32,
    chaotic: 0.14
  };
  if (!state.rng.chance(priorityChance[player.behavior] ?? 0)) return null;

  const candidates = state.spyFollowUpOpportunities
    .filter((opportunity) =>
      opportunity.playerId === player.id
      && opportunity.status === "open"
      && opportunity.expiryStep >= step
    )
    .map((opportunity) => ({
      opportunity,
      score: opportunity.confidence + (hasActiveBountyOnTarget(state, opportunity.targetPlayerId) ? 0.25 : 0)
    }))
    .sort((left, right) => right.score - left.score);

  for (const candidate of candidates) {
    const targetView = findAttackTargetView(
      state,
      player.id,
      candidate.opportunity.sourceDistrictId,
      candidate.opportunity.targetDistrictId
    );
    const command = createBaseCommand<AttackDistrictCommand>(player, "attack-district", commandId(player, "follow-up-attack", step), {
      districtId: candidate.opportunity.targetDistrictId,
      sourceDistrictId: candidate.opportunity.sourceDistrictId,
      weapons: { ...(targetView?.selectedLoadout ?? {}) },
      expectedConflictRevision: targetView?.expectedConflictRevision ?? -1,
      expectedSourceVersion: targetView?.expectedSourceVersion,
      expectedTargetVersion: targetView?.expectedTargetVersion
    }, state.clock);
    const planned: PlannedCommand = {
      command,
      focusDistrictId: candidate.opportunity.sourceDistrictId,
      actionKind: "attack",
      targetDistrictId: candidate.opportunity.targetDistrictId,
      targetPlayerId: candidate.opportunity.targetPlayerId,
      followUpOpportunityId: candidate.opportunity.id
    };
    const readiness = evaluatePlannedCommandReadiness(state, player, planned);
    candidate.opportunity.currentlyValid = readiness.canSubmit;
    if (!readiness.canSubmit) {
      candidate.opportunity.status = "blocked";
      candidate.opportunity.blockedReason = readiness.reasonCode;
      recordReadinessSkip(state, player, planned, step, readiness);
      continue;
    }
    candidate.opportunity.status = "submitted";
    candidate.opportunity.attackCommandId = command.id;
    state.followUpAttackAudits.push({
      spyStep: candidate.opportunity.stepCreated,
      attackStep: step,
      playerId: player.id,
      behavior: player.behavior,
      targetDistrictId: candidate.opportunity.targetDistrictId,
      targetPlayerId: candidate.opportunity.targetPlayerId,
      attackCommandId: command.id
    });
    return { ...planned, readiness };
  }

  return null;
};

const createSpyFollowUpOpportunity = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  input: {
    sourceDistrictId: string;
    targetDistrictId: string;
    targetPlayerId: string;
    step: number;
  }
): SpyFollowUpOpportunityAudit => {
  const existing = state.spyFollowUpOpportunities.find((opportunity) =>
    opportunity.playerId === player.id
    && opportunity.targetDistrictId === input.targetDistrictId
    && opportunity.status === "open"
  );
  if (existing) return existing;
  const opportunity: SpyFollowUpOpportunityAudit = {
    id: `follow-up:${player.id}:${input.targetDistrictId}:${input.step}:${state.spyFollowUpOpportunities.length + 1}`,
    playerId: player.id,
    behavior: player.behavior,
    targetDistrictId: input.targetDistrictId,
    targetPlayerId: input.targetPlayerId,
    sourceDistrictId: input.sourceDistrictId,
    stepCreated: input.step,
    expiryStep: input.step + 120,
    confidence: round(0.65 + player.riskTolerance * 0.25 + (hasActiveBountyOnTarget(state, input.targetPlayerId) ? 0.2 : 0), 3),
    currentlyValid: hasValidAttackPath(state, player.id, input.targetPlayerId),
    status: "open",
    blockedReason: null,
    attackCommandId: null
  };
  state.spyFollowUpOpportunities.push(opportunity);
  return opportunity;
};

const expireSpyFollowUpOpportunities = (state: MutableSimulationState, step: number): void => {
  for (const opportunity of state.spyFollowUpOpportunities) {
    if (opportunity.status === "open" && opportunity.expiryStep < step) {
      opportunity.status = "expired";
      opportunity.blockedReason = "expired";
    }
  }
};

const updateFollowUpOpportunityAfterAttempt = (
  state: MutableSimulationState,
  planned: PlannedCommand,
  attempt: CommandAttemptAudit,
  readModel: GameplaySliceView | null
): void => {
  if (!planned.followUpOpportunityId) return;
  const opportunity = state.spyFollowUpOpportunities.find((entry) => entry.id === planned.followUpOpportunityId);
  if (!opportunity) return;
  if (!attempt.accepted) {
    opportunity.status = "blocked";
    opportunity.blockedReason = attempt.errors[0] ?? "server_rejected";
    return;
  }
  const report = readModel?.reports.find((entry) => entry.reportType === "battle");
  opportunity.status = report?.reportType === "battle" && (report.result === "success" || report.districtCaptured)
    ? "successful"
    : "accepted";
  opportunity.blockedReason = null;
};

const runSpecialCoverageStep = async (state: MutableSimulationState, step: number): Promise<void> => {
  const configured = state.metrics.buildings.availableSpecialActions;
  const completedKeys = new Set(state.specialCoverageAttempts
    .map((attempt) => `${attempt.buildingTypeId}:${attempt.actionId}`));
  const alreadyAttemptedThisStep = new Set<string>();

  for (const player of state.players) {
    const planned = planSpecialCoverageCommand(state, player, step, configured, completedKeys, alreadyAttemptedThisStep);
    if (!planned) continue;
    const readiness = evaluatePlannedCommandReadiness(state, player, planned);
    const coverageKey = planned.coverageActionKey ?? "unknown:unknown";
    const [buildingTypeId = "unknown", actionId = "unknown"] = coverageKey.split(":", 2);
    if (!readiness.canSubmit) {
      state.specialCoverageAttempts.push({
        step,
        playerId: player.id,
        buildingTypeId,
        actionId,
        status: "skipped",
        reasonCode: readiness.reasonCode
      });
      recordReadinessSkip(state, player, planned, step, readiness);
      completedKeys.add(coverageKey);
      alreadyAttemptedThisStep.add(coverageKey);
      continue;
    }
    state.specialCoverageAttempts.push({
      step,
      playerId: player.id,
      buildingTypeId,
      actionId,
      status: "submitted",
      reasonCode: null
    });
    await submitPlannedCommand(state, player, { ...planned, readiness }, step);
    completedKeys.add(coverageKey);
    alreadyAttemptedThisStep.add(coverageKey);
  }
};

const planSpecialCoverageCommand = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  step: number,
  configured: Array<{ buildingTypeId: string; actionId: string }>,
  completedKeys: Set<string>,
  alreadyAttemptedThisStep: Set<string>
): PlannedCommand | null => {
  const wantedKeys = configured
    .map((action) => `${action.buildingTypeId}:${action.actionId}`)
    .filter((key) => !completedKeys.has(key) && !alreadyAttemptedThisStep.has(key));
  if (wantedKeys.length === 0) return null;

  const actionCandidatesByKey = new Map<string, Array<{
    panel: DistrictPanelView;
    slice: GameplaySliceView;
    building: DistrictPanelView["buildings"][number];
    action: BuildingActionView;
  }>>();
  for (const { panel, slice } of getOwnedDistrictPanels(state, player)) {
    for (const building of panel.buildings) {
      for (const action of building.actions) {
        const key = `${building.buildingTypeId}:${action.actionId}`;
        const list = actionCandidatesByKey.get(key) ?? [];
        list.push({ panel, slice, building, action });
        actionCandidatesByKey.set(key, list);
      }
    }
  }

  for (const key of wantedKeys) {
    const [buildingTypeId, actionId] = key.split(":", 2);
    const candidate = actionCandidatesByKey.get(key)?.[0];
    if (!candidate) continue;
    const input = resolveBuildingActionInput(candidate.action, candidate.panel, candidate.slice, state, player);
    if (!input) {
      state.specialCoverageAttempts.push({
        step,
        playerId: player.id,
        buildingTypeId: buildingTypeId ?? "unknown",
        actionId: actionId ?? "unknown",
        status: "skipped",
        reasonCode: "missing_input_or_resources"
      });
      alreadyAttemptedThisStep.add(key);
      continue;
    }
    return {
      command: createBaseCommand<RunBuildingActionCommand>(player, "run-building-action", commandId(player, `special-coverage-${actionId}`, step), {
        districtId: candidate.panel.districtId,
        buildingId: candidate.building.buildingId,
        actionId: candidate.action.actionId,
        ...input
      }, state.clock),
      focusDistrictId: candidate.panel.districtId,
      actionKind: "building_action",
      targetDistrictId: candidate.panel.districtId,
      targetPlayerId: player.id,
      coverageActionKey: key
    };
  }
  return null;
};

const updateSpecialCoverageAfterAttempt = (
  state: MutableSimulationState,
  planned: PlannedCommand,
  attempt: CommandAttemptAudit
): void => {
  if (!planned.coverageActionKey) return;
  const [buildingTypeId = "unknown", actionId = "unknown"] = planned.coverageActionKey.split(":", 2);
  const submitted = [...state.specialCoverageAttempts].reverse().find((entry) =>
    entry.step === attempt.step
    && entry.playerId === attempt.playerId
    && entry.buildingTypeId === buildingTypeId
    && entry.actionId === actionId
    && entry.status === "submitted"
  );
  if (submitted) {
    submitted.status = attempt.accepted ? "accepted" : "rejected";
    submitted.reasonCode = attempt.accepted ? null : attempt.errors[0] ?? "unknown";
  }
};

const configureScenarioWorld = (state: MutableSimulationState): void => {
  if (state.scenario !== "conflict-fixture") return;
  const runtime = getRuntime(state.server);
  const districtsById = { ...runtime.state.districtsById };
  const allianceOwner = state.players.find((player) => player.behavior === "diplomat_alliance");
  const allianceContributor = state.players.find((player) => player.behavior === "defensive_builder");
  const allianceId = "alliance:simulation-defense";
  if (allianceOwner && allianceContributor) {
    const memberIds = [allianceOwner.id, allianceContributor.id];
    runtime.state.alliancesById[allianceId] = {
      id: allianceId,
      serverInstanceId: runtime.state.serverInstance.id,
      name: "Simulation Defense Pact",
      tag: "SIM",
      ownerPlayerId: allianceOwner.id,
      memberIds,
      status: "active",
      createdAt: state.clock.nowIso(),
      version: 1
    };
    for (const playerId of memberIds) {
      const member = runtime.state.playersById[playerId];
      if (!member) continue;
      runtime.state.playersById[playerId] = { ...member, allianceId, version: member.version + 1 };
      const homeDistrict = runtime.state.districtsById[member.homeDistrictId ?? ""];
      if (homeDistrict) {
        districtsById[homeDistrict.id] = {
          ...homeDistrict,
          controllerAllianceId: allianceId,
          version: homeDistrict.version + 1
        };
      }
    }
    runtime.state.root.allianceIds = uniqueSorted([...runtime.state.root.allianceIds, allianceId]);
  }
  const homeDistrictIds = state.players
    .map((player) => player.homeDistrictId)
    .filter((districtId): districtId is string => Boolean(districtId && districtsById[districtId]));
  const offlinePlayer = state.players.at(-1);
  if (offlinePlayer) offlinePlayer.activityRate = 0;

  for (let index = 0; index < homeDistrictIds.length; index += 1) {
    const districtId = homeDistrictIds[index]!;
    const previousId = homeDistrictIds[(index - 1 + homeDistrictIds.length) % homeDistrictIds.length]!;
    const nextId = homeDistrictIds[(index + 1) % homeDistrictIds.length]!;
    const district = districtsById[districtId];
    if (!district) continue;
    districtsById[districtId] = {
      ...district,
      adjacentDistrictIds: uniqueSorted([...district.adjacentDistrictIds, previousId, nextId]),
      status: district.status === "destroyed" ? "claimed" : district.status,
      version: district.version + 1
    };
  }

  const coveragePlayer = state.players[0];
  const coverageHome = coveragePlayer ? districtsById[coveragePlayer.homeDistrictId] : null;
  const neutralTarget = Object.values(districtsById).find((district) =>
    district.ownerPlayerId === null && district.status !== "destroyed" && !homeDistrictIds.includes(district.id)
  );
  let coverageNotificationId: string | null = null;
  if (coveragePlayer && coverageHome && neutralTarget) {
    const targetRevision = Math.max(1, Number(neutralTarget.securityRevision ?? neutralTarget.version));
    districtsById[coverageHome.id] = {
      ...coverageHome,
      adjacentDistrictIds: uniqueSorted([...coverageHome.adjacentDistrictIds, neutralTarget.id]),
      heat: Math.max(300, Number(coverageHome.heat ?? 0)),
      version: coverageHome.version + 1
    };
    districtsById[neutralTarget.id] = {
      ...neutralTarget,
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "neutral",
      defenseLoadout: {},
      adjacentDistrictIds: uniqueSorted([...neutralTarget.adjacentDistrictIds, coverageHome.id]),
      securityRevision: targetRevision,
      version: neutralTarget.version + 1
    };
    const playerState = runtime.state.playersById[coveragePlayer.id];
    const resources = runtime.state.resourceStatesById[playerState.resourceStateId];
    runtime.state.resourceStatesById[playerState.resourceStateId] = {
      ...resources,
      balances: { ...resources.balances, influence: 5_000, population: Math.max(100, Number(resources.balances.population ?? 0)) },
      version: resources.version + 1
    };
    runtime.state.playersById[coveragePlayer.id] = {
      ...playerState,
      population: Math.max(100, Number(playerState.population ?? 0)),
      version: playerState.version + 1
    };
    const police = runtime.state.policeStatesById[playerState.policeStateId];
    runtime.state.policeStatesById[playerState.policeStateId] = {
      ...police,
      heat: Math.max(500, Number(police.heat ?? 0)),
      wantedLevel: 5,
      version: police.version + 1
    };
    coverageNotificationId = `notification:simulation-occupy-intel:${coveragePlayer.id}`;
    runtime.state.notificationsById[coverageNotificationId] = {
      id: coverageNotificationId,
      recipientType: "player",
      recipientId: coveragePlayer.id,
      category: "report.spy",
      title: `Spy report: ${neutralTarget.id}`,
      bodyKey: "report.spy",
      payload: {
        reportId: `report:simulation-occupy-intel:${coveragePlayer.id}`,
        reportType: "spy", actionType: "spy-district", playerId: coveragePlayer.id,
        attackerPlayerId: coveragePlayer.id, sourceDistrictId: coverageHome.id,
        targetDistrictId: neutralTarget.id, targetOwnerPlayerId: null, targetStateAtSpy: "empty",
        targetSecurityRevision: targetRevision, purpose: "occupy_empty_district", result: "success",
        authorizationScope: "occupy_empty_district", issuedAtTick: runtime.state.root.tick,
        authorizationExpiresAtTick: runtime.state.root.tick + 120, tick: runtime.state.root.tick,
        createdAt: state.clock.nowIso(), eventId: null
      },
      createdAt: state.clock.nowIso(),
      readAt: null
    };
  }

  runtime.state = {
    ...runtime.state,
    districtsById,
    root: {
      ...runtime.state.root,
      notificationIds: coverageNotificationId
        ? uniqueSorted([...runtime.state.root.notificationIds, coverageNotificationId])
        : runtime.state.root.notificationIds,
      version: runtime.state.root.version + 1
    }
  };
  state.warnings.push("Conflict fixture rewired only simulation home-district adjacency so enemy-owned frontier targets are available; combat rules were not changed.");
  state.warnings.push("Conflict fixture seeded one two-player alliance so allied defense conservation is exercised deterministically.");
  state.warnings.push("Conflict fixture seeded one neutral occupy target, police pressure, and one zero-activity offline participant.");
};

const submitPlannedCommand = async (
  state: MutableSimulationState,
  player: SimulationPlayer,
  planned: PlannedCommand,
  step: number
): Promise<void> => {
  const runtime = getRuntime(state.server);
  const before = summarizePlayerResources(runtime.state, player.id);
  const targetBefore = planned.targetPlayerId ? summarizePlayerResources(runtime.state, planned.targetPlayerId) : null;
  const payloadHash = stableJson(planned.command);
  const duplicateReplay = state.sentPayloadByCommandId.has(planned.command.id);
  const previousPayload = state.sentPayloadByCommandId.get(planned.command.id);
  if (!duplicateReplay) {
    state.sentPayloadByCommandId.set(planned.command.id, payloadHash);
  }

  try {
    const response = await state.server.gameplaySliceTransport.submit({
      sessionToken: player.sessionToken,
      expectedStateVersion: runtime.state.root.version,
      focusDistrictId: planned.focusDistrictId,
      command: planned.command
    });
    const errors = response.errors.map((error) => error.code);
    const after = summarizePlayerResources(runtime.state, player.id);
    const buildingMetadata = getBuildingCommandMetadata(runtime.state, planned.command);
    const attempt: CommandAttemptAudit = {
      step,
      tick: runtime.state.root.tick,
      playerId: player.id,
      behavior: player.behavior,
      factionId: player.factionId,
      commandId: planned.command.id,
      commandType: planned.command.type,
      actionKind: planned.actionKind,
      accepted: response.accepted,
      duplicateReplay,
      expectedRejection: planned.expectedRejection === true,
      errors,
      rejectionCategories: dedupe(errors.map(classifyRejectionCode)) as RejectionCategory[],
      focusDistrictId: planned.focusDistrictId,
      targetDistrictId: planned.targetDistrictId ?? null,
      targetPlayerId: planned.targetPlayerId ?? null,
      targetType: resolveTargetType(runtime.state, player.id, planned.targetDistrictId ?? null, planned.targetPlayerId ?? null),
      buildingTypeId: buildingMetadata.buildingTypeId,
      buildingActionId: buildingMetadata.actionId,
      resourcesBefore: before,
      resourcesAfter: after,
      resourceDelta: diffResourceSummary(before, after),
      attackGlobalCooldownUntilTick: planned.command.type === "attack-district" && response.accepted
        ? Number(runtime.state.cooldownStatesById[
            runtime.state.playersById[player.id]?.cooldownStateId ?? ""
          ]?.cooldowns["attack:global"] ?? 0)
        : null
    };
    state.commandAttempts.push(attempt);
    updateCommandMetrics(state, player, planned, response, duplicateReplay, previousPayload !== undefined && previousPayload !== payloadHash);
    if (!duplicateReplay) {
      updateDomainMetrics(state, player, planned, response.readModel, response.accepted, before, targetBefore);
    }
    updateFollowUpOpportunityAfterAttempt(state, planned, attempt, response.readModel);
    updateSpecialCoverageAfterAttempt(state, planned, attempt);

    if (!duplicateReplay) {
      await maybeSubmitFollowUpAttackAfterSpy(state, player, planned, response, step);
    }

    if (
      planned.command.type === "run-building-action"
      && response.accepted
      && !duplicateReplay
      && state.rng.chance(0.25)
    ) {
      await submitCooldownProbe(state, player, planned, step);
    }

    if (duplicateReplay && previousPayload !== payloadHash && !errors.includes("server.command_payload_conflict")) {
      state.invariantViolations.push(`Payload conflict was not reported for duplicate command ${planned.command.id}.`);
    }
  } catch (error) {
    state.metrics.commands.errors += 1;
    state.metrics.stability.runtimeErrors += 1;
    state.errors.push(`Command ${planned.command.id} crashed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!planned.expectedRejection && state.rng.chance(0.025)) {
    await submitDuplicateReplay(state, player, planned, step);
  }
};

const maybeSubmitFollowUpAttackAfterSpy = async (
  state: MutableSimulationState,
  player: SimulationPlayer,
  planned: PlannedCommand,
  response: Awaited<ReturnType<ServerApp["gameplaySliceTransport"]["submit"]>>,
  step: number
): Promise<void> => {
  if (planned.command.type !== "spy-district" || !response.accepted || !planned.targetPlayerId) {
    return;
  }

  const spyPayload = planned.command.payload as SpyDistrictCommand["payload"];
  const spyReport = response.readModel?.reports.find((report) =>
    report.reportType === "spy"
    && report.sourceDistrictId === spyPayload.sourceDistrictId
    && report.targetDistrictId === spyPayload.districtId
    && report.result === "success"
  );
  if (!spyReport) {
    return;
  }

  const runtimeState = getRuntime(state.server).state;
  const sourceDistrict = runtimeState.districtsById[spyPayload.sourceDistrictId];
  const targetDistrict = runtimeState.districtsById[spyPayload.districtId];
  if (
    !sourceDistrict
    || !targetDistrict?.ownerPlayerId
    || sourceDistrict.ownerPlayerId !== player.id
    || targetDistrict.ownerPlayerId === player.id
    || areAllied(runtimeState, player.id, targetDistrict.ownerPlayerId)
  ) {
    return;
  }

  const opportunity = createSpyFollowUpOpportunity(state, player, {
    sourceDistrictId: spyPayload.sourceDistrictId,
    targetDistrictId: spyPayload.districtId,
    targetPlayerId: targetDistrict.ownerPlayerId,
    step
  });

  const followUpChances: Record<BehaviorArchetype, number> = {
    aggressive_attacker: state.scenario === "conflict-fixture" ? 0.86 : 0.58,
    defensive_builder: 0.04,
    spy_intelligence: 0.22,
    diplomat_alliance: 0.05,
    bounty_hunter: state.scenario === "conflict-fixture" ? 0.62 : 0.38,
    economy_optimizer: 0.06,
    balanced_casual: 0.18,
    chaotic: 0.34,
    heat_risk: 0.56,
    special_building_user: 0.10
  };
  if (!state.rng.chance(followUpChances[player.behavior])) {
    return;
  }

  const attackCommandId = commandId(player, "attack-after-spy", step);
  const targetView = findAttackTargetView(
    state,
    player.id,
    spyPayload.sourceDistrictId,
    spyPayload.districtId
  );
  const followUpPlan: PlannedCommand = {
    command: createBaseCommand<AttackDistrictCommand>(player, "attack-district", attackCommandId, {
      districtId: spyPayload.districtId,
      sourceDistrictId: spyPayload.sourceDistrictId,
      weapons: { ...(targetView?.selectedLoadout ?? {}) },
      expectedConflictRevision: targetView?.expectedConflictRevision ?? -1,
      expectedSourceVersion: targetView?.expectedSourceVersion,
      expectedTargetVersion: targetView?.expectedTargetVersion
    }, state.clock),
    focusDistrictId: spyPayload.sourceDistrictId,
    actionKind: "attack",
    targetDistrictId: spyPayload.districtId,
    targetPlayerId: targetDistrict.ownerPlayerId,
    followUpOpportunityId: opportunity.id
  };
  const readiness = evaluatePlannedCommandReadiness(state, player, followUpPlan);
  if (!readiness.canSubmit) {
    opportunity.status = "blocked";
    opportunity.blockedReason = readiness.reasonCode;
    opportunity.currentlyValid = false;
    recordReadinessSkip(state, player, followUpPlan, step, readiness);
    return;
  }

  state.followUpAttackAudits.push({
    spyStep: step,
    attackStep: step,
    playerId: player.id,
    behavior: player.behavior,
    targetDistrictId: spyPayload.districtId,
    targetPlayerId: targetDistrict.ownerPlayerId,
    attackCommandId
  });
  opportunity.status = "submitted";
  opportunity.attackCommandId = attackCommandId;
  await submitPlannedCommand(state, player, { ...followUpPlan, readiness }, step);
};

const submitDuplicateReplay = async (
  state: MutableSimulationState,
  player: SimulationPlayer,
  planned: PlannedCommand,
  step: number
): Promise<void> => {
  await submitPlannedCommand(state, player, planned, step);
};

const submitCooldownProbe = async (
  state: MutableSimulationState,
  player: SimulationPlayer,
  planned: PlannedCommand,
  step: number
): Promise<void> => {
  const command = {
    ...planned.command,
    id: `${planned.command.id}:cooldown-probe`
  } as GameCommand;
  const probe: PlannedCommand = {
    ...planned,
    command,
    expectedRejection: true
  };
  await submitPlannedCommand(state, player, probe, step);
  const lastAttempt = state.commandAttempts[state.commandAttempts.length - 1];
  if (lastAttempt?.accepted) {
    state.metrics.buildings.cooldownViolations += 1;
    state.invariantViolations.push(`Building action cooldown was bypassed by ${command.id}.`);
  }
};

const submitNegativeProbe = async (
  state: MutableSimulationState,
  player: SimulationPlayer,
  step: number
): Promise<void> => {
  const runtimeState = getRuntime(state.server).state;
  const focusDistrictId = firstOwnedDistrictId(runtimeState, player.id);
  if (!focusDistrictId) return;
  const targetPlayer = state.players.find((candidate) => candidate.id !== player.id) ?? player;
  const probeKind = step % 120 === 0 ? "payload-conflict" : step % 80 === 0 ? "self-bounty" : "missing-spy";

  if (probeKind === "payload-conflict") {
    const command = createBaseCommand(player, "spy-district", `command:${player.id}:payload-conflict:${step}`, {
      districtId: focusDistrictId,
      sourceDistrictId: focusDistrictId
    }, state.clock);
    const first: PlannedCommand = {
      command,
      focusDistrictId,
      actionKind: "probe",
      expectedRejection: true,
      targetDistrictId: focusDistrictId,
      targetPlayerId: player.id
    };
    await submitPlannedCommand(state, player, first, step);
    const changed = {
      ...command,
      payload: {
        districtId: firstOwnedDistrictId(runtimeState, targetPlayer.id) ?? focusDistrictId,
        sourceDistrictId: focusDistrictId
      }
    } as GameCommand;
    await submitPlannedCommand(state, player, {
      ...first,
      command: changed
    }, step);
    return;
  }

  if (probeKind === "self-bounty") {
    const command = createBaseCommand<CreateBountyCommand>(player, "create-bounty", commandId(player, "self-bounty-probe", step), {
      targetPlayerId: player.id,
      objectiveType: "attack-player",
      targetDistrictId: null,
      rewardCleanCash: 5000,
      durationHours: 1,
      isAnonymous: false
    }, state.clock);
    await submitPlannedCommand(state, player, {
      command,
      focusDistrictId,
      actionKind: "probe",
      expectedRejection: true,
      targetDistrictId: focusDistrictId,
      targetPlayerId: player.id
    }, step);
    const lastAttempt = state.commandAttempts[state.commandAttempts.length - 1];
    if (lastAttempt?.accepted) {
      state.invariantViolations.push("Self bounty creation was accepted.");
    }
    return;
  }

  const command = createBaseCommand(player, "spy-district", commandId(player, "missing-target-probe", step), {
    districtId: `district:missing:${step}`,
    sourceDistrictId: focusDistrictId
  }, state.clock);
  await submitPlannedCommand(state, player, {
    command,
    focusDistrictId,
    actionKind: "probe",
    expectedRejection: true,
    targetDistrictId: `district:missing:${step}`,
    targetPlayerId: null
  }, step);
  const lastAttempt = state.commandAttempts[state.commandAttempts.length - 1];
  if (lastAttempt?.accepted) {
    state.invariantViolations.push("Spy against a missing district was accepted.");
  }
};

const runInvariantProbes = async (state: MutableSimulationState): Promise<void> => {
  const player = state.players[0];
  if (!player) return;
  await submitNegativeProbe(state, player, state.steps + 1);
};

const runTick = (state: MutableSimulationState): void => {
  const runtime = getRuntime(state.server);
  state.clock.advance(runtime.config.tickRateMs);
  state.server.instanceManager.tickInstance(INSTANCE_ID);
};

const updateCommandMetrics = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  planned: PlannedCommand,
  response: Awaited<ReturnType<ServerApp["gameplaySliceTransport"]["submit"]>>,
  duplicateReplay: boolean,
  payloadChanged: boolean
): void => {
  const metrics = state.metrics.commands;
  metrics.totalSubmitted += 1;
  increment(metrics.byType, planned.command.type);
  increment(metrics.byPlayer, player.id);
  if (response.accepted) {
    metrics.successful += 1;
    increment(metrics.acceptedByPlayer, player.id);
  } else {
    metrics.rejected += 1;
    const hasPayloadConflict = response.errors.some((error) => error.code === "server.command_payload_conflict");
    for (const error of response.errors) {
      increment(metrics.rejectedByCode, error.code);
    }
    if (hasPayloadConflict) {
      metrics.payloadConflicts += 1;
    }
    if (planned.expectedRejection) {
      metrics.expectedRejectionProbes += 1;
    }
  }
  if (duplicateReplay && !payloadChanged) {
    metrics.duplicateOrIdempotent += 1;
  }
};

const updateDomainMetrics = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  planned: PlannedCommand,
  readModel: GameplaySliceView | null,
  responseAccepted: boolean,
  before: ResourceSummary,
  targetBefore: ResourceSummary | null
): void => {
  const command = planned.command;
  const runtimeState = getRuntime(state.server).state;
  const after = summarizePlayerResources(runtimeState, player.id);
  const heatDelta = Math.max(0, after.heat - before.heat);
  if (heatDelta > 0) {
    state.metrics.heatRisk.heatGainByAction[command.type] = (state.metrics.heatRisk.heatGainByAction[command.type] ?? 0) + heatDelta;
  }

  switch (command.type) {
    case "attack-district": {
      state.metrics.combat.attacks += 1;
      increment(state.metrics.combat.attacksByPlayer, player.id);
      increment(state.metrics.combat.attacksByFaction, player.factionId);
      if (planned.targetPlayerId) increment(state.metrics.combat.victimsByPlayer, planned.targetPlayerId);
      const report = readModel?.reports.find((entry) => entry.reportType === "battle");
      if (report?.reportType === "battle" && (report.result === "success" || report.districtCaptured)) {
        state.metrics.combat.successfulAttacks += 1;
        state.metrics.combat.attackerOccupationLosses += report.occupationPopulationLoss;
        state.currentCaptureStreak = state.lastCapturePlayerId === player.id
          ? state.currentCaptureStreak + 1
          : 1;
        state.lastCapturePlayerId = player.id;
        state.metrics.combat.maxConsecutiveCaptureStreak = Math.max(
          state.metrics.combat.maxConsecutiveCaptureStreak,
          state.currentCaptureStreak
        );
        if (!report.survivingDefenseAbandoned) {
          state.metrics.combat.capturedDefenseTransferViolations += 1;
          state.invariantViolations.push(`Captured defense was not abandoned for ${planned.command.id}.`);
        }
      } else if (report?.reportType === "battle") {
        state.metrics.combat.failedAttacks += 1;
      }
      if (report?.reportType === "battle" && (sumRecord(report.attackerLosses) > 0 || sumRecord(report.defenderLosses) > 0)) {
        state.metrics.combat.damageOrLossEvents += 1;
      }
      if (planned.targetPlayerId && areAllied(runtimeState, player.id, planned.targetPlayerId)) {
        state.metrics.combat.attacksOnAllies += 1;
        state.metrics.alliances.attacksOnAllies += 1;
      }
      break;
    }
    case "spy-district": {
      state.metrics.spying.actions += 1;
      increment(state.metrics.spying.byPlayer, player.id);
      if (planned.targetDistrictId) increment(state.metrics.spying.targetCounts, planned.targetDistrictId);
      const report = readModel?.reports.find((entry) => entry.reportType === "spy");
      if (report?.reportType === "spy") {
        if (report.result === "success") {
          state.metrics.spying.success += 1;
          if (planned.targetPlayerId) {
            state.successfulSpyIntel.push({
              step: planned.command.id.includes(":") ? Number(planned.command.id.split(":").at(-1) ?? 0) || 0 : 0,
              playerId: player.id,
              behavior: player.behavior,
              sourceDistrictId: report.sourceDistrictId,
              targetDistrictId: report.targetDistrictId,
              targetPlayerId: planned.targetPlayerId
            });
          }
        } else if (report.result === "partial") state.metrics.spying.partial += 1;
        else state.metrics.spying.failed += 1;
      }
      break;
    }
    case "heist-district":
      state.metrics.combat.heists += 1;
      break;
    case "rob-district":
      state.metrics.combat.robs += 1;
      break;
    case "occupy-district":
      state.metrics.combat.occupations += 1;
      break;
    case "place-defense":
      if (responseAccepted) {
        state.metrics.combat.defensePlacements += 1;
        if (planned.targetPlayerId && planned.targetPlayerId !== player.id) {
          state.metrics.combat.alliedDefensePlacements += 1;
        }
      }
      break;
    case "place-trap":
    case "relocate-trap":
      if (responseAccepted) state.metrics.combat.trapPlacements += 1;
      break;
    case "create-alliance":
      state.metrics.alliances.createRequests += 1;
      break;
    case "join-alliance":
      state.metrics.alliances.joinRequests += 1;
      break;
    case "invite-alliance-member":
      state.metrics.alliances.invitesSent += 1;
      break;
    case "respond-alliance-invite": {
      const response = (command.payload as { response?: string }).response;
      if (response === "accept") state.metrics.alliances.acceptedInvites += 1;
      if (response === "reject") state.metrics.alliances.rejectedInvites += 1;
      break;
    }
    case "disband-alliance":
      state.metrics.alliances.disbanded += 1;
      break;
    case "create-bounty": {
      const bounty = Object.values(runtimeState.bountiesById ?? {}).find((entry) => entry.id === `bounty:${command.id}`);
      if (bounty) {
        state.metrics.bounty.created += 1;
        state.metrics.bounty.totalValue += bounty.rewardCleanCash;
        state.metrics.bounty.largestBounty = Math.max(state.metrics.bounty.largestBounty, bounty.rewardCleanCash);
        increment(state.metrics.bounty.byCreator, bounty.createdByPlayerId);
        increment(state.metrics.bounty.byTarget, bounty.targetPlayerId);
        state.bountyAuditRecords.push({
          bountyId: bounty.id,
          createdStep: planned.command.id.includes(":") ? Number(planned.command.id.split(":").at(-1) ?? 0) || 0 : 0,
          creatorPlayerId: bounty.createdByPlayerId,
          creatorBehavior: player.behavior,
          targetPlayerId: bounty.targetPlayerId,
          targetDistrictId: bounty.targetDistrictId,
          objectiveType: bounty.objectiveType,
          rewardCleanCash: bounty.rewardCleanCash,
          status: bounty.status,
          claimedByPlayerId: bounty.claimedByPlayerId,
          claimedAtTick: bounty.claimedAtTick,
          expiresAtTick: bounty.expiresAtTick
        });
      }
      break;
    }
    case "run-building-action": {
      const payload = command.payload as RunBuildingActionCommand["payload"];
      const buildingTypeId = runtimeState.buildingsById[payload.buildingId]?.buildingTypeId ?? "unknown";
      if (responseAccepted) {
        state.metrics.buildings.specialActions += 1;
        increment(state.metrics.buildings.specialActionsByAction, payload.actionId);
        increment(state.metrics.buildings.specialActionsByType, buildingTypeId);
      } else {
        state.metrics.buildings.invalidSpecialAttempts += 1;
      }
      break;
    }
    case "upgrade-building":
      if (after.cleanCash < before.cleanCash || after.materials < before.materials) {
        state.metrics.buildings.upgrades += 1;
      }
      break;
    case "collect-production":
      state.metrics.economy.collects += 1;
      break;
    case "buy-market-resource":
      state.metrics.economy.marketBuys += 1;
      break;
    case "sell-market-resource":
      state.metrics.economy.marketSells += 1;
      break;
    default:
      break;
  }

  if (targetBefore && planned.targetPlayerId) {
    const targetAfter = summarizePlayerResources(runtimeState, planned.targetPlayerId);
    const loss = Math.max(0, targetBefore.cleanCash + targetBefore.dirtyCash - targetAfter.cleanCash - targetAfter.dirtyCash);
    if (loss > 0) {
      state.metrics.combat.damageOrLossEvents += 1;
    }
  }
};

const buildReport = async (
  state: MutableSimulationState,
  wallClockMs: number
): Promise<ClosedAlphaSimulationReport> => {
  const runtime = getRuntime(state.server);
  const finalResources = Object.fromEntries(state.players.map((player) => [
    player.id,
    summarizePlayerResources(runtime.state, player.id)
  ]));
  finalizeMetrics(state, finalResources);
  const distribution = countBy(state.players, (player) => player.factionId);
  const maxOccurrence = maxValue(distribution);
  const commandRecords = await state.server.instanceManager.listCommandRecords(INSTANCE_ID);
  const eventRecords = await state.server.instanceManager.listEventRecords(INSTANCE_ID);
  const snapshotDivergence = Math.abs(commandRecords.length - eventRecords.length);
  state.metrics.stability.snapshotCommandLogDivergence = snapshotDivergence;
  if (snapshotDivergence > 0) {
    state.warnings.push(`Command/event audit log count differs by ${snapshotDivergence}. Atomic event records store command-applied envelopes.`);
  }

  const bountyStatusCounts = countBy(Object.values(runtime.state.bountiesById ?? {}), (bounty) => bounty.status);
  state.metrics.bounty.claimed = bountyStatusCounts.claimed ?? 0;
  state.metrics.bounty.expired = bountyStatusCounts.expired ?? 0;
  state.metrics.bounty.cancelled = bountyStatusCounts.cancelled ?? 0;
  state.metrics.bounty.selfClaimAbuseDetected = Object.values(runtime.state.bountiesById ?? {}).some((bounty) =>
    bounty.claimedByPlayerId !== null && bounty.claimedByPlayerId === bounty.createdByPlayerId
  );
  if (state.metrics.bounty.selfClaimAbuseDetected) {
    state.invariantViolations.push("A bounty was claimed by its creator.");
  }
  state.bountyAuditRecords = state.bountyAuditRecords.map((record) => {
    const bounty = runtime.state.bountiesById?.[record.bountyId];
    return bounty
      ? {
          ...record,
          status: bounty.status,
          claimedByPlayerId: bounty.claimedByPlayerId,
          claimedAtTick: bounty.claimedAtTick,
          expiresAtTick: bounty.expiresAtTick
        }
      : record;
  });

  const rawEventCounters = countBy(eventRecords, (record) => record.event.type);
  const livenessViews = state.players.map((player) => ({
    playerId: player.id,
    status: runtime.state.playersById[player.id]?.status,
    view: resolvePlayerOperationalLiveness(runtime.state, player.id, { config: runtime.config })
  }));
  const activeLivenessViews = livenessViews.filter((entry) => entry.status === "active");
  const invalidLiveness = activeLivenessViews.filter((entry) =>
    entry.view.invalidInvariant
    || (!entry.view.canProgressNow && !entry.view.canProgressLater && !entry.view.emergencyRecovery.canClaim));
  for (const entry of invalidLiveness) {
    const message = `ACTIVE_PLAYER_SOFTLOCKED:${entry.playerId}:${entry.view.state}`;
    if (!state.invariantViolations.includes(message)) state.invariantViolations.push(message);
  }
  const liveness = {
    stateCounts: countBy(livenessViews, (entry) => entry.view.state),
    invalidSoftlocks: invalidLiveness.length,
    playersWithNoValidOrigin: activeLivenessViews.filter((entry) => entry.view.usableOriginDistrictIds.length === 0).length,
    playersWithNoFutureDeadline: activeLivenessViews.filter((entry) => !entry.view.canProgressNow && entry.view.nextProgressAtTick === null).length,
    defeatedPlayers: livenessViews.filter((entry) => entry.status === "defeated").length,
    lastStandActivations: Object.values(runtime.state.playersById).filter((player) => player.lastStandUsedAtTick != null).length,
    emergencyRecoveryClaims: Object.values(runtime.state.playersById).filter((player) => player.emergencyRecoveryUsedAtTick != null).length
  };
  const report: ClosedAlphaSimulationReport = {
    name: "20-player mixed-behavior closed-alpha simulation",
    passed: state.invariantViolations.length === 0 && state.errors.length === 0,
    config: {
      seed: state.seed,
      steps: state.steps,
      playerCount: state.players.length,
      scenario: state.scenario,
      tickRateMs: runtime.config.tickRateMs,
      resourceFieldMapping: {
        cleanCash: "resource.balances.cash",
        dirtyCash: "resource.balances['dirty-cash']",
        influence: "sum(district.influence for owned districts)",
        heat: "policeState.heat + sum(district.heat for owned districts)",
        materials: `sum(${MATERIAL_RESOURCE_IDS.join(", ")})`
      },
      maxFactionOccurrences: MAX_FACTION_OCCURRENCES
    },
    runtime: {
      completed: state.metrics.stability.completed,
      finalTick: runtime.state.root.tick,
      wallClockMs: Math.max(0, Math.round(wallClockMs))
    },
    players: state.players.map(({ sessionToken: _sessionToken, ...player }) => player),
    factions: {
      availableFactionCount: FACTION_DEFINITIONS.length,
      requiredFactionCount: Math.ceil(state.players.length / MAX_FACTION_OCCURRENCES),
      distribution,
      maxOccurrence
    },
    initialResources: state.initialResources,
    finalResources,
    liveness,
    metrics: state.metrics,
    diagnostics: buildDiagnostics(state, finalResources, rawEventCounters),
    warnings: dedupe([
      ...state.warnings,
      ...buildWarnings(state)
    ]),
    errors: state.errors,
    invariantViolations: state.invariantViolations,
    rawEventCounters,
    commandAttemptsSample: state.commandAttempts.slice(0, 300),
    recommendations: buildRecommendations(state)
  };

  report.passed = report.invariantViolations.length === 0 && report.errors.length === 0;
  return report;
};

export const formatClosedAlphaMarkdownReport = (report: ClosedAlphaSimulationReport): string => {
  const lines = [
    "# 20-player mixed-behavior closed-alpha simulation",
    "",
    "## Shrnutí",
    `- Verdict: **${report.passed ? "PASS" : "FAIL"}**`,
    `- Seed: \`${report.config.seed}\``,
    `- Scenario: \`${report.config.scenario}\``,
    `- Steps/ticks: ${report.config.steps} / ${report.runtime.finalTick}`,
    `- Players spawned: ${report.players.length}`,
    `- Max faction occurrence: ${report.factions.maxOccurrence}/${report.config.maxFactionOccurrences}`,
    `- Commands: ${report.metrics.commands.totalSubmitted} submitted, ${report.metrics.commands.successful} accepted, ${report.metrics.commands.rejected} rejected`,
    `- Attacks: ${report.metrics.combat.attacks} (${report.metrics.combat.successfulAttacks} success, ${report.metrics.combat.failedAttacks} failed)`,
    `- Spy: ${report.metrics.spying.actions} (${report.metrics.spying.success} success, ${report.metrics.spying.partial} partial, ${report.metrics.spying.failed} failed)`,
    `- Alliances active: ${report.metrics.alliances.activeAlliances.length}`,
    `- Bounty: ${report.metrics.bounty.created} created, ${report.metrics.bounty.claimed} claimed, value ${round(report.metrics.bounty.totalValue)}`,
    `- Building specials: ${report.metrics.buildings.specialActions}`,
    `- Skipped not ready: ${report.diagnostics.actionReadiness.skippedNotReadyActions}`,
    `- Police raids: ${report.diagnostics.policeRaids.triggered} triggered, ${report.diagnostics.policeRaids.pendingFinal} pending final`,
    `- Invariant violations: ${report.invariantViolations.length}`,
    "",
    "## Akceptační kontroly",
    `- 20 hráčů naspawnováno: ${yesNo(report.players.length === 20)}`,
    `- Žádná frakce víc než 3x: ${yesNo(report.factions.maxOccurrence <= 3)}`,
    `- Startovní zdroje přesně 5000/1000/0/0/0: ${yesNo(Object.values(report.initialResources).every(matchesStartingResources))}`,
    `- Simulace doběhla: ${yesNo(report.runtime.completed)}`,
    `- Nevalidní stavy: ${report.metrics.stability.invalidStates}`,
    "",
    "## Hráči",
    "| Player | Faction | Behavior | Activity | Risk | Start clean/dirty/inf/heat/mat | Final clean/dirty/inf/heat/mat |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...report.players.map((player) => {
      const start = report.initialResources[player.id]!;
      const end = report.finalResources[player.id]!;
      return `| ${player.id} | ${player.factionId} | ${player.behavior} | ${player.activityBand} | ${player.riskTolerance.toFixed(2)} | ${resourceTuple(start)} | ${resourceTuple(end)} |`;
    }),
    "",
    "## Frakce",
    "| Faction | Players | Final wealth |",
    "| --- | ---: | ---: |",
    ...Object.entries(report.factions.distribution).map(([factionId, count]) =>
      `| ${factionId} | ${count} | ${round(sumPlayersByFaction(report, factionId))} |`
    ),
    "",
    "## Commandy",
    `- Nejúspěšnější / nejaktivnější: ${report.metrics.commands.mostActivePlayer ?? "n/a"}`,
    `- Nejméně aktivní: ${report.metrics.commands.leastActivePlayer ?? "n/a"}`,
    `- Duplicate/idempotent replay: ${report.metrics.commands.duplicateOrIdempotent}`,
    `- Payload conflicts: ${report.metrics.commands.payloadConflicts}`,
    `- Skipped-not-ready actions: ${report.diagnostics.actionReadiness.skippedNotReadyActions}`,
    `- Planner-avoidable rejects: ${report.diagnostics.actionReadiness.plannerAvoidableRejects}`,
    `- True server rejects: ${report.diagnostics.actionReadiness.trueServerRejects}`,
    "",
    "## Konflikt",
    `- Nejčastější útočník: ${report.metrics.combat.mostFrequentAttacker ?? "n/a"}`,
    `- Nejčastější oběť: ${report.metrics.combat.mostFrequentVictim ?? "n/a"}`,
    `- Heists: ${report.metrics.combat.heists}`,
    `- Robs: ${report.metrics.combat.robs}`,
    `- Occupations: ${report.metrics.combat.occupations}`,
    `- Defense placements: ${report.metrics.combat.defensePlacements} (${report.metrics.combat.alliedDefensePlacements} allied)`,
    `- Trap placements/relocations: ${report.metrics.combat.trapPlacements}`,
    `- District share top 1/top 3: ${(report.metrics.combat.top1DistrictShare * 100).toFixed(1)} % / ${(report.metrics.combat.top3DistrictShare * 100).toFixed(1)} %`,
    `- Max capture streak: ${report.metrics.combat.maxConsecutiveCaptureStreak}`,
    `- Average attack interval: ${report.metrics.combat.averageAttackIntervalTicks} ticks`,
    `- Attacker occupation losses: ${report.metrics.combat.attackerOccupationLosses}`,
    `- Simultaneous conflict commands: ${report.metrics.combat.simultaneousConflictCommands}`,
    `- Attacks on allies: ${report.metrics.combat.attacksOnAllies}`,
    "",
    "## Špionáž",
    `- Nejčastější cíl: ${report.metrics.spying.mostFrequentTarget ?? "n/a"}`,
    `- Invalid information leaks: ${report.metrics.spying.invalidInformationLeaks}`,
    "",
    "## Aliance",
    "| Alliance | Members |",
    "| --- | --- |",
    ...(report.metrics.alliances.activeAlliances.length
      ? report.metrics.alliances.activeAlliances.map((alliance) => `| ${alliance.name} | ${alliance.members.join(", ")} |`)
      : ["| n/a | n/a |"]),
    "",
    "## Bounty",
    `- Created: ${report.metrics.bounty.created}`,
    `- Claimed: ${report.metrics.bounty.claimed}`,
    `- Expired: ${report.metrics.bounty.expired}`,
    `- Largest bounty: ${report.metrics.bounty.largestBounty}`,
    `- Self-claim abuse detected: ${yesNo(report.metrics.bounty.selfClaimAbuseDetected)}`,
    `- Bounty conflict lift: ${report.diagnostics.bountyOpportunityFunnel.bountyConflictLift ?? "n/a"}`,
    "",
    "## Budovy",
    `- Upgrades: ${report.metrics.buildings.upgrades}`,
    `- Special actions: ${report.metrics.buildings.specialActions}`,
    `- Cooldown violations: ${report.metrics.buildings.cooldownViolations}`,
    `- Most used building: ${report.metrics.buildings.mostUsedBuilding ?? "n/a"}`,
    `- Unused special action configs: ${report.metrics.buildings.unusedSpecialActions.length}`,
    `- Coverage accepted/rejected: ${report.diagnostics.buildingSpecialCoverage.acceptedSpecialActions}/${report.diagnostics.buildingSpecialCoverage.rejectedSpecialActions}`,
    "",
    "## Police raids",
    `- Config day/night concurrent limit: ${report.diagnostics.policeRaids.dayLimit}/${report.diagnostics.policeRaids.nightLimit}`,
    `- Triggered/resolved/expired: ${report.diagnostics.policeRaids.triggered}/${report.diagnostics.policeRaids.resolved}/${report.diagnostics.policeRaids.expired}`,
    `- Pending final: ${report.diagnostics.policeRaids.pendingFinal}`,
    `- Conclusion: ${report.diagnostics.policeRaids.conclusion}`,
    "",
    "## Ekonomika a balance",
    `- Total wealth: ${round(report.metrics.economy.totalStartingWealth)} -> ${round(report.metrics.economy.totalFinalWealth)}`,
    `- Average growth: ${round(report.metrics.economy.averageGrowth)}`,
    `- Median growth: ${round(report.metrics.economy.medianGrowth)}`,
    `- Gini wealth: ${report.metrics.fairness.giniWealth.toFixed(3)}`,
    `- Top/median wealth ratio: ${report.metrics.fairness.topToMedianWealthRatio.toFixed(2)}`,
    `- Highest heat: ${round(report.metrics.heatRisk.maxHeat)} (${report.metrics.heatRisk.highestHeatPlayer ?? "n/a"})`,
    "",
    "## Technické chyby",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- Žádné runtime errors."]),
    "",
    "## Invariant violations",
    ...(report.invariantViolations.length ? report.invariantViolations.map((item) => `- ${item}`) : ["- Žádné."]),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ["- Žádné."]),
    "",
    "## Doporučení před closed alpha",
    ...report.recommendations.map((item) => `- ${item}`),
    ""
  ];
  return `${lines.join("\n")}\n`;
};

export const formatClosedAlphaDiagnosticsMarkdown = (report: ClosedAlphaSimulationReport): string => {
  const d = report.diagnostics;
  const topRejected = d.rejectedCommands.topReasons.slice(0, 12);
  const unusedActions = d.buildingSpecialCoverage.actions.filter((action) => action.usedCount === 0);
  const lines = [
    "# 20-player mixed-behavior closed-alpha diagnostics",
    "",
    "## Executive summary",
    `- Verdict: **${report.passed ? "PASS" : "FAIL"}**`,
    `- Seed: \`${report.config.seed}\`, scenario: \`${report.config.scenario}\`, steps: ${report.config.steps}`,
    `- Rejected rate: ${(d.rejectedCommands.rejectedRate * 100).toFixed(1)}%`,
    `- Skipped-not-ready actions: ${d.actionReadiness.skippedNotReadyActions}`,
    `- Spy-to-attack conversion: ${(d.conflict.spyToAttackConversionRate * 100).toFixed(1)}% (${d.conflict.followUpAttacksAfterSpy}/${d.conflict.relevantSuccessfulSpies})`,
    `- Active alliances: ${report.metrics.alliances.activeAlliances.length}`,
    `- Bounty claim rate: ${(d.bounty.claimRate * 100).toFixed(1)}%`,
    `- Unused building special actions: ${d.buildingSpecialCoverage.unusedActions}/${d.buildingSpecialCoverage.totalConfigured}`,
    `- Gini: ${report.metrics.fairness.giniWealth.toFixed(3)}, top/median wealth: ${report.metrics.fairness.topToMedianWealthRatio.toFixed(2)}`,
    `- Police raids: ${d.policeRaids.triggered} triggered, ${d.policeRaids.pendingFinal} pending final`,
    "",
    "## PASS/FAIL",
    `- Completed: ${yesNo(report.runtime.completed)}`,
    `- Runtime errors: ${report.metrics.stability.runtimeErrors}`,
    `- Invariant violations: ${report.invariantViolations.length}`,
    "",
    "## Seeds and steps",
    `- Seed: \`${report.config.seed}\``,
    `- Steps: ${report.config.steps}`,
    `- Tick: ${report.runtime.finalTick}`,
    "",
    "## Aggregate metrics",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Total commands | ${report.metrics.commands.totalSubmitted} |`,
    `| Accepted commands | ${report.metrics.commands.successful} |`,
    `| Rejected commands | ${report.metrics.commands.rejected} |`,
    `| Attacks | ${report.metrics.combat.attacks} |`,
    `| Successful attacks | ${report.metrics.combat.successfulAttacks} |`,
    `| Spy actions | ${report.metrics.spying.actions} |`,
    `| Bounty created | ${report.metrics.bounty.created} |`,
    `| Bounty claimed | ${report.metrics.bounty.claimed} |`,
    `| Building specials | ${report.metrics.buildings.specialActions} |`,
    `| Skipped not ready | ${d.actionReadiness.skippedNotReadyActions} |`,
    `| Planner avoidable rejects | ${d.actionReadiness.plannerAvoidableRejects} |`,
    `| True server rejects | ${d.actionReadiness.trueServerRejects} |`,
    `| Police raids triggered | ${d.policeRaids.triggered} |`,
    "",
    "## Action readiness summary",
    `- Submitted commands: ${d.actionReadiness.submittedCommands}`,
    `- Skipped-not-ready actions: ${d.actionReadiness.skippedNotReadyActions}`,
    `- Submitted rejects: ${d.actionReadiness.rejectedCommands}`,
    `- Planner-avoidable rejects: ${d.actionReadiness.plannerAvoidableRejects}`,
    `- True server rejects: ${d.actionReadiness.trueServerRejects}`,
    `- Readiness skip reasons: ${formatCounts(d.actionReadiness.skipReasons) || "none"}`,
    `- Planner-avoidable reject reasons: ${formatCounts(d.actionReadiness.plannerAvoidableRejectReasons) || "none"}`,
    `- True server reject reasons: ${formatCounts(d.actionReadiness.trueServerRejectReasons) || "none"}`,
    "",
    "## Rejected command breakdown",
    "| Reason | Count | % | Category | Commands | Suggested fix |",
    "| --- | ---: | ---: | --- | --- | --- |",
    ...(topRejected.length
      ? topRejected.map((row) => `| ${row.reason} | ${row.count} | ${row.percentage.toFixed(1)} | ${row.category} | ${row.affectedCommandTypes.join(", ")} | ${row.suggestedFix} |`)
      : ["| n/a | 0 | 0 | n/a | n/a | n/a |"]),
    "",
    "## Alliance pacing audit",
    `- Create command exists: ${yesNo(d.alliance.commandsAvailable.createAlliance)}`,
    `- Invite/join/accept commands exist: ${yesNo(d.alliance.commandsAvailable.inviteAllianceMember && d.alliance.commandsAvailable.joinAlliance && d.alliance.commandsAvailable.respondAllianceInvite)}`,
    `- Required influence: ${d.alliance.requiredInfluence}`,
    `- Create intentions/skipped/submitted/accepted/rejected: ${d.alliance.allianceCreateIntentions}/${d.alliance.allianceCreateSkippedNotEnoughInfluence}/${d.alliance.allianceCreateSubmitted}/${d.alliance.allianceCreateAccepted}/${d.alliance.allianceCreateRejected}`,
    `- First ready/created step: ${d.alliance.firstAllianceReadyStep ?? "n/a"}/${d.alliance.firstAllianceCreatedStep ?? "n/a"}`,
    `- Players ever eligible: ${d.alliance.playersEverEligible.length ? d.alliance.playersEverEligible.join(", ") : "none"}`,
    `- Diplomat alliance attempts: ${d.alliance.diplomatAllianceAttempts}`,
    `- Rejected alliance commands: ${d.alliance.rejectedAllianceCommands}`,
    `- Conclusion: ${d.alliance.conclusion}`,
    "",
    "| Step | Player | Behavior | Influence | Cash | Eligible | Attempted | Result | Errors |",
    "| ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |",
    ...d.alliance.readinessTimeline.slice(0, 40).map((row) =>
      `| ${row.step} | ${row.playerId} | ${row.behavior} | ${round(row.influence, 1)} | ${round(row.cleanCash)} | ${yesNo(row.meetsInfluenceRequirement)} | ${yesNo(row.attemptedAllianceAction)} | ${row.result} | ${row.errors.join(", ") || "n/a"} |`
    ),
    "",
    "## Conflict density audit",
    `- Attack primary intentions: ${d.conflict.attackPrimaryIntentions}`,
    `- Attack plan failures before fallback: ${d.conflict.attackPlanFailures}`,
    `- Attack readiness skipped: ${d.conflict.attackReadinessSkipped}`,
    `- Submitted/accepted/rejected attacks: ${d.conflict.submittedAttacks}/${d.conflict.acceptedAttacks}/${d.conflict.rejectedAttacks}`,
    `- Successful attacks: ${d.conflict.successfulAttacks}`,
    `- Attack failure reasons: ${formatCounts(d.conflict.attackPlanFailureReasons)}`,
    `- Planned attack failure reasons: ${formatCounts(d.conflict.plannedAttackFailureReasons)}`,
    `- Rejected attack reasons: ${formatCounts(d.conflict.rejectedAttackReasons)}`,
    `- Conclusion: ${d.conflict.conclusion}`,
    "",
    "## Conflict fixture result",
    `- Scenario active: ${yesNo(report.config.scenario === "conflict-fixture")}`,
    `- Enemy-owned frontier targets are fixture-seeded only in conflict-fixture mode.`,
    `- Attack intentions/planning failures/readiness skips/submitted/accepted: ${d.conflict.attackPrimaryIntentions}/${d.conflict.attackPlanFailures}/${d.conflict.attackReadinessSkipped}/${d.conflict.submittedAttacks}/${d.conflict.acceptedAttacks}`,
    `- Spy authorizations created/used by attack: ${d.conflict.spyAuthorizationsCreated}/${d.conflict.spyAuthorizationUsedByAttack}`,
    "",
    "## Spy-to-attack conversion",
    `- Relevant successful spies: ${d.conflict.relevantSuccessfulSpies}`,
    `- Follow-up attacks after spy: ${d.conflict.followUpAttacksAfterSpy}`,
    `- Conversion rate: ${(d.conflict.spyToAttackConversionRate * 100).toFixed(1)}%`,
    `- Average steps between spy and attack: ${d.conflict.averageStepsBetweenSpyAndAttack ?? "best-effort immediate/unknown"}`,
    "",
    "## Spy follow-up queue",
    `- Opportunities created/open/expired: ${d.spyFollowUpQueue.opportunitiesCreated}/${d.spyFollowUpQueue.openOpportunities}/${d.spyFollowUpQueue.opportunitiesExpired}`,
    `- Follow-up attacks submitted/accepted/successful: ${d.spyFollowUpQueue.attacksSubmitted}/${d.spyFollowUpQueue.attacksAccepted}/${d.spyFollowUpQueue.attacksSuccessful}`,
    `- Blocked reasons: ${formatCounts(d.spyFollowUpQueue.blockedReasons) || "none"}`,
    "",
    "## Bounty audit",
    `- Created: ${d.bounty.created}`,
    `- Claimed: ${d.bounty.claimed}`,
    `- Claim rate: ${(d.bounty.claimRate * 100).toFixed(1)}%`,
    `- Attacks on bounty targets vs others: ${d.bounty.attacksOnPlayersWithBounty}/${d.bounty.attacksOnPlayersWithoutBounty}`,
    `- Bounty conflict lift: ${d.bounty.bountyConflictLift === null ? "n/a" : d.bounty.bountyConflictLift.toFixed(2)}`,
    `- Valid attack paths: ${d.bounty.targetsWithValidAttackPath}/${d.bounty.records.length}`,
    `- Claim funnel submitted/accepted/rejected: ${d.bounty.claimSubmitted}/${d.bounty.claimAccepted}/${d.bounty.claimRejected}`,
    `- Conclusion: ${d.bounty.conclusion}`,
    "",
    "## Bounty opportunity funnel",
    `- Created: ${d.bountyOpportunityFunnel.bountyCreated}`,
    `- Targets with/without valid attack path: ${d.bountyOpportunityFunnel.bountyTargetsWithValidAttackPath}/${d.bountyOpportunityFunnel.bountyTargetsWithoutValidAttackPath}`,
    `- Claim intentions/skipped/submitted/accepted/rejected/claimed: ${d.bountyOpportunityFunnel.bountyClaimAttemptIntentions}/${d.bountyOpportunityFunnel.bountyClaimSkippedNoValidAttack}/${d.bountyOpportunityFunnel.bountyClaimSubmitted}/${d.bountyOpportunityFunnel.bountyClaimAccepted}/${d.bountyOpportunityFunnel.bountyClaimRejected}/${d.bountyOpportunityFunnel.bountyClaimed}`,
    `- Unclaimed reasons: ${formatCounts(d.bountyOpportunityFunnel.bountyUnclaimedReasons) || "none"}`,
    "",
    "| Bounty | Creator | Target | Objective | Reward | Status | Claimed by |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...(d.bounty.records.length
      ? d.bounty.records.map((row) => `| ${row.bountyId} | ${row.creatorPlayerId} | ${row.targetPlayerId} | ${row.objectiveType} | ${row.rewardCleanCash} | ${row.status} | ${row.claimedByPlayerId ?? "n/a"} |`)
      : ["| n/a | n/a | n/a | n/a | 0 | n/a | n/a |"]),
    "",
    "## Building special action coverage",
    `- Configured: ${d.buildingSpecialCoverage.totalConfigured}`,
    `- Reachable/submitted/accepted/rejected: ${d.buildingSpecialCoverage.reachableSpecialActions}/${d.buildingSpecialCoverage.submittedSpecialActions}/${d.buildingSpecialCoverage.acceptedSpecialActions}/${d.buildingSpecialCoverage.rejectedSpecialActions}`,
    `- Truly unreachable: ${d.buildingSpecialCoverage.trulyUnreachableSpecialActions}`,
    `- Behavior ignored: ${d.buildingSpecialCoverage.behaviorIgnoredSpecialActions}`,
    `- Used: ${d.buildingSpecialCoverage.usedActions}`,
    `- Unused: ${d.buildingSpecialCoverage.unusedActions}`,
    `- Categories: ${formatCounts(d.buildingSpecialCoverage.categories)}`,
    "",
    "## Building special coverage mode",
    `- Scenario active: ${yesNo(report.config.scenario === "special-coverage")}`,
    `- Coverage mode keeps normal behavior separate and attempts configured building special actions via server submit.`,
    `- Total/reachable/submitted/accepted/rejected/truly unreachable: ${d.buildingSpecialCoverage.totalConfigured}/${d.buildingSpecialCoverage.reachableSpecialActions}/${d.buildingSpecialCoverage.submittedSpecialActions}/${d.buildingSpecialCoverage.acceptedSpecialActions}/${d.buildingSpecialCoverage.rejectedSpecialActions}/${d.buildingSpecialCoverage.trulyUnreachableSpecialActions}`,
    "",
    "| Building | Action | Used | Rejected | Category | Reason |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...(unusedActions.length
      ? unusedActions.map((row) => `| ${row.buildingTypeId} | ${row.actionId} | ${row.usedCount} | ${row.rejectedCount} | ${row.unusedCategory ?? "n/a"} | ${row.suggestedReason} |`)
      : ["| n/a | n/a | 0 | 0 | n/a | All configured actions were used. |"]),
    "",
    "## Snowball/balance audit",
    `- Top player: ${d.snowball.topPlayerBreakdown.playerId ?? "n/a"} (${d.snowball.topPlayerBreakdown.behavior ?? "n/a"})`,
    `- Final wealth: ${round(d.snowball.topPlayerBreakdown.finalWealth)}`,
    `- Heat: ${round(d.snowball.topPlayerBreakdown.heat)}`,
    `- Positive wealth by source: ${formatCounts(d.snowball.topPlayerBreakdown.positiveWealthDeltaBySource)}`,
    `- Top income sources overall: ${d.snowball.topIncomeSourcesOverall.map((row) => `${row.source}: ${round(row.amount, 2)}`).join(", ") || "none"}`,
    `- Top behavior by net gain: ${d.snowball.topBehaviorByNetWealthGain ? `${d.snowball.topBehaviorByNetWealthGain.behavior}: ${round(d.snowball.topBehaviorByNetWealthGain.netWealthGain, 2)}` : "n/a"}`,
    `- Top faction by net gain: ${d.snowball.topFactionByNetWealthGain ? `${d.snowball.topFactionByNetWealthGain.factionId}: ${round(d.snowball.topFactionByNetWealthGain.netWealthGain, 2)}` : "n/a"}`,
    `- Conclusion: ${d.snowball.conclusion}`,
    "",
    "| Step from | Step to | Player | Behavior | Wealth delta |",
    "| ---: | ---: | --- | --- | ---: |",
    ...d.snowball.topSnowballMoments.slice(0, 5).map((row) =>
      `| ${row.stepFrom} | ${row.stepTo} | ${row.playerId} | ${row.behavior} | ${round(row.wealthDelta)} |`
    ),
    "",
    "## Police raids",
    `- Day/night concurrent limit: ${d.policeRaids.dayLimit}/${d.policeRaids.nightLimit}`,
    `- Triggered/resolved/expired/pending: ${d.policeRaids.triggered}/${d.policeRaids.resolved}/${d.policeRaids.expired}/${d.policeRaids.pendingFinal}`,
    `- Severity: ${formatCounts(d.policeRaids.bySeverity) || "none"}`,
    `- By player: ${formatCounts(d.policeRaids.byPlayer) || "none"}`,
    `- Conclusion: ${d.policeRaids.conclusion}`,
    "",
    "## Boost audit",
    `- Standalone boost command found: ${yesNo(d.boost.standaloneCommandFound)}`,
    `- Command names: ${d.boost.commandNames.join(", ") || "none"}`,
    `- Boost-like building/faction actions: ${d.boost.buildingOrFactionBoostLikeActions.join(", ") || "none"}`,
    `- Conclusion: ${d.boost.conclusion}`,
    "",
    "## Top risks before closed alpha",
    ...report.warnings.slice(0, 8).map((warning) => `- ${warning}`),
    "",
    "## Recommended next changes",
    ...[
      ...d.alliance.recommendations,
      "Add a focused conflict scenario with adjacent bounty targets before tuning combat rewards.",
      "Classify building actions that require late-game resources in config/UI so bots and players do not treat them as early-game options."
    ].map((item) => `- ${item}`),
    ""
  ];
  return `${lines.join("\n")}\n`;
};

export const formatClosedAlphaAggregateMarkdownReport = (aggregate: ClosedAlphaAggregateReport): string => {
  const metricRows = [
    "totalCommands",
    "acceptedCommands",
    "rejectedCommands",
    "rejectedRate",
    "skippedNotReadyActions",
    "plannerAvoidableRejects",
    "trueServerRejects",
    "attacks",
    "successfulAttacks",
    "spyActions",
    "spyToAttackConversionRate",
    "bountyCreated",
    "bountyClaimed",
    "bountyClaimRate",
    "allianceRequests",
    "activeAlliances",
    "buildingSpecialActionsUsed",
    "unusedSpecialActionCount",
    "policeRaidsTriggered",
    "policeRaidsPendingFinal",
    "gini",
    "topMedianWealthRatio"
  ];
  const lines = [
    "# 20-player mixed-behavior closed-alpha aggregate simulation",
    "",
    "## Executive summary",
    `- Verdict: **${aggregate.passed ? "PASS" : "FAIL"}**`,
    `- Seeds: ${aggregate.config.seeds.length}`,
    `- Steps per seed: ${aggregate.config.steps}`,
    `- Scenario: \`${aggregate.config.scenario}\``,
    `- Pass/fail: ${aggregate.runtime.passCount}/${aggregate.runtime.failCount}`,
    `- Runtime errors: ${aggregate.runtime.runtimeErrors}`,
    `- Invariant violations: ${aggregate.runtime.invariantViolations}`,
    "",
    "## Aggregate metrics",
    "| Metric | Avg | Median | Min | Max | Std dev |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...metricRows.map((key) => {
      const stat = aggregate.metrics[key] ?? emptyStatSummary();
      return `| ${key} | ${round(stat.average, 3)} | ${round(stat.median, 3)} | ${round(stat.min, 3)} | ${round(stat.max, 3)} | ${round(stat.standardDeviation, 3)} |`;
    }),
    "",
    "## Runs",
    "| Seed | Pass | Commands | Rejected % | Attacks | Spy | Spy->Attack % | Bounty C/C | Alliances | Unused specials | Gini | Top behavior | Top faction |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- | --- |",
    ...aggregate.runSummaries.map((run) =>
      `| ${run.seed} | ${yesNo(run.passed)} | ${run.totalCommands} | ${(run.rejectedRate * 100).toFixed(1)} | ${run.attacks} | ${run.spyActions} | ${(run.spyToAttackConversionRate * 100).toFixed(1)} | ${run.bountyCreated}/${run.bountyClaimed} | ${run.activeAlliances} | ${run.unusedSpecialActions} | ${run.gini.toFixed(3)} | ${run.topBehaviorStyle ?? "n/a"} | ${run.topFaction ?? "n/a"} |`
    ),
    "",
    "## Top rejected reasons",
    "| Reason | Count | Category | Commands | Suggested fix |",
    "| --- | ---: | --- | --- | --- |",
    ...aggregate.rejectedCommandAggregate.topReasons.slice(0, 10).map((row) =>
      `| ${row.reason} | ${row.count} | ${row.category} | ${row.affectedCommandTypes.join(", ")} | ${row.suggestedFix} |`
    ),
    "",
    "## Recommendations",
    ...aggregate.recommendations.map((item) => `- ${item}`),
    ""
  ];
  return `${lines.join("\n")}\n`;
};

export const formatClosedAlphaAggregateDiagnosticsMarkdown = (aggregate: ClosedAlphaAggregateReport): string => {
  const d = aggregate.diagnostics;
  const unionUnused = d.buildingSpecialCoverage.actions
    .filter((action) => action.runsUnused > 0)
    .map((action) => `${action.buildingTypeId}:${action.actionId} (usedRuns=${action.runsUsed}, unusedRuns=${action.runsUnused}; ${formatCounts(action.unusedCategories) || "used in some runs"})`);
  const lines = [
    "# 20-player mixed-behavior closed-alpha multi-seed diagnostics",
    "",
    "## Executive summary",
    `- Verdict: **${aggregate.passed ? "PASS" : "FAIL"}**`,
    `- Seeds and steps: ${aggregate.config.seeds.length} x ${aggregate.config.steps}`,
    `- Scenario: \`${aggregate.config.scenario}\``,
    `- Average rejected rate: ${((aggregate.metrics.rejectedRate?.average ?? 0) * 100).toFixed(1)}%`,
    `- Average skipped-not-ready actions: ${round(aggregate.metrics.skippedNotReadyActions?.average ?? 0, 2)}`,
    `- Average attacks: ${round(aggregate.metrics.attacks?.average ?? 0, 2)}`,
    `- Average spy-to-attack conversion: ${((aggregate.metrics.spyToAttackConversionRate?.average ?? 0) * 100).toFixed(1)}%`,
    `- Average active alliances: ${round(aggregate.metrics.activeAlliances?.average ?? 0, 2)}`,
    `- Average bounty claim rate: ${((aggregate.metrics.bountyClaimRate?.average ?? 0) * 100).toFixed(1)}%`,
    "",
    "## PASS/FAIL",
    `- PASS runs: ${aggregate.runtime.passCount}`,
    `- FAIL runs: ${aggregate.runtime.failCount}`,
    `- Runtime errors: ${aggregate.runtime.runtimeErrors}`,
    `- Invariant violations: ${aggregate.runtime.invariantViolations}`,
    "",
    "## Seeds and steps",
    `- Steps: ${aggregate.config.steps}`,
    `- Seeds: ${aggregate.config.seeds.join(", ")}`,
    "",
    "## Aggregate metrics",
    formatAggregateMetricBullets(aggregate),
    "",
    "## Action readiness summary",
    `- Submitted commands avg: ${round(d.actionReadiness.submittedCommands.average, 2)}`,
    `- Skipped-not-ready avg: ${round(d.actionReadiness.skippedNotReadyActions.average, 2)}`,
    `- Rejected commands avg: ${round(d.actionReadiness.rejectedCommands.average, 2)}`,
    `- Planner-avoidable rejects avg: ${round(d.actionReadiness.plannerAvoidableRejects.average, 2)}`,
    `- True server rejects avg: ${round(d.actionReadiness.trueServerRejects.average, 2)}`,
    `- Skip reasons: ${formatCounts(d.actionReadiness.skipReasons) || "none"}`,
    `- Planner-avoidable reject reasons: ${formatCounts(d.actionReadiness.plannerAvoidableRejectReasons) || "none"}`,
    `- True server reject reasons: ${formatCounts(d.actionReadiness.trueServerRejectReasons) || "none"}`,
    "",
    "## Rejected command breakdown",
    ...aggregate.rejectedCommandAggregate.topReasons.slice(0, 12).map((row) =>
      `- ${row.reason}: ${row.count} (${row.category}); commands=${row.affectedCommandTypes.join(", ")}; fix=${row.suggestedFix}`
    ),
    "",
    "## Alliance pacing audit",
    `- Average active alliances: ${round(aggregate.metrics.activeAlliances?.average ?? 0, 2)}`,
    `- Required influence: ${d.alliance.requiredInfluence}`,
    `- Diplomat alliance attempts: ${d.alliance.totalDiplomatAllianceAttempts}`,
    `- Rejected alliance commands: ${d.alliance.totalRejectedAllianceCommands}`,
    `- Rejection reasons: ${formatCounts(d.alliance.rejectionReasons) || "none"}`,
    `- Max influence observed: ${d.alliance.maxInfluenceObserved}`,
    `- Eligible players by seed: ${Object.entries(d.alliance.playersEverEligibleBySeed).map(([seed, players]) => `${seed}=${players.join(",") || "none"}`).join("; ")}`,
    `- Conclusion pattern: ${formatCounts(d.alliance.conclusionCounts) || "n/a"}`,
    "",
    "## Conflict density audit",
    `- Average attacks: ${round(aggregate.metrics.attacks?.average ?? 0, 2)}`,
    `- Average successful attacks: ${round(aggregate.metrics.successfulAttacks?.average ?? 0, 2)}`,
    `- Average spy actions: ${round(aggregate.metrics.spyActions?.average ?? 0, 2)}`,
    `- Attack primary intentions: ${d.conflict.attackPrimaryIntentions}`,
    `- Attack plan failures before submit: ${d.conflict.attackPlanFailures}`,
    `- Attack plan failure reasons: ${formatCounts(d.conflict.attackPlanFailureReasons) || "none"}`,
    `- Submitted/accepted/rejected attacks: ${d.conflict.submittedAttacks}/${d.conflict.acceptedAttacks}/${d.conflict.rejectedAttacks}`,
    `- Rejected attack reasons: ${formatCounts(d.conflict.rejectedAttackReasons) || "none"}`,
    "",
    "## Conflict fixture result",
    `- Scenario active: ${yesNo(aggregate.config.scenario === "conflict-fixture")}`,
    `- Aggregate attack intentions/failures/submitted/accepted: ${d.conflict.attackPrimaryIntentions}/${d.conflict.attackPlanFailures}/${d.conflict.submittedAttacks}/${d.conflict.acceptedAttacks}`,
    "",
    "## Spy-to-attack conversion",
    `- Average conversion: ${((aggregate.metrics.spyToAttackConversionRate?.average ?? 0) * 100).toFixed(1)}%`,
    `- Relevant successful spies: ${d.conflict.relevantSuccessfulSpies}`,
    `- Follow-up attacks after spy: ${d.conflict.followUpAttacksAfterSpy}`,
    `- Average spy-to-attack step gap: ${round(d.conflict.averageStepsBetweenSpyAndAttack.average, 2)}`,
    "",
    "## Bounty audit",
    `- Average created: ${round(aggregate.metrics.bountyCreated?.average ?? 0, 2)}`,
    `- Average claimed: ${round(aggregate.metrics.bountyClaimed?.average ?? 0, 2)}`,
    `- Average claim rate: ${((aggregate.metrics.bountyClaimRate?.average ?? 0) * 100).toFixed(1)}%`,
    `- Aggregate created/claimed: ${d.bounty.created}/${d.bounty.claimed}`,
    `- Unclaimed reasons: ${formatCounts(d.bounty.unclaimedReasons) || "none"}`,
    `- Attacks on bounty/non-bounty targets: ${d.bounty.attacksOnPlayersWithBounty}/${d.bounty.attacksOnPlayersWithoutBounty}`,
    `- Bounty conflict lift: avg=${round(d.bounty.bountyConflictLift.average, 2)}, min=${round(d.bounty.bountyConflictLift.min, 2)}, max=${round(d.bounty.bountyConflictLift.max, 2)}`,
    `- Self-claim abuse runs: ${d.bounty.selfClaimAbuseDetectedRuns}`,
    "",
    "## Building special action coverage",
    `- Average unused special action count: ${round(aggregate.metrics.unusedSpecialActionCount?.average ?? 0, 2)}`,
    `- Configured actions: ${d.buildingSpecialCoverage.totalConfigured}`,
    `- Used action count: avg=${round(d.buildingSpecialCoverage.usedActionCount.average, 2)}, min=${round(d.buildingSpecialCoverage.usedActionCount.min, 2)}, max=${round(d.buildingSpecialCoverage.usedActionCount.max, 2)}`,
    `- Unused categories: ${formatCounts(d.buildingSpecialCoverage.categories) || "none"}`,
    `- Unused action union: ${dedupe(unionUnused).slice(0, 60).join(", ") || "none"}`,
    "",
    "## Building special coverage mode",
    `- Scenario active: ${yesNo(aggregate.config.scenario === "special-coverage")}`,
    `- Coverage accepted/rejected averages are in per-run reports; aggregate unused categories show remaining blockers.`,
    "",
    "## Police raids",
    `- Day/night concurrent limit: ${d.policeRaids.dayLimit}/${d.policeRaids.nightLimit}`,
    `- Triggered avg/min/max: ${round(d.policeRaids.triggered.average, 2)}/${round(d.policeRaids.triggered.min, 2)}/${round(d.policeRaids.triggered.max, 2)}`,
    `- Resolved avg: ${round(d.policeRaids.resolved.average, 2)}`,
    `- Pending final avg: ${round(d.policeRaids.pendingFinal.average, 2)}`,
    `- Severity: ${formatCounts(d.policeRaids.bySeverity) || "none"}`,
    `- Conclusion pattern: ${formatCounts(d.policeRaids.conclusionCounts) || "n/a"}`,
    "",
    "## Snowball/balance audit",
    `- Average Gini: ${round(aggregate.metrics.gini?.average ?? 0, 3)}`,
    `- Average top/median wealth ratio: ${round(aggregate.metrics.topMedianWealthRatio?.average ?? 0, 2)}`,
    `- Top behavior frequencies: ${formatCounts(aggregate.topBehaviorStyles)}`,
    `- Top faction frequencies: ${formatCounts(aggregate.topFactions)}`,
    ...d.snowball.topPlayerBreakdowns.map((breakdown) =>
      `- ${breakdown.seed}: ${breakdown.playerId ?? "n/a"} ${breakdown.behavior ?? "n/a"} wealth=${round(breakdown.finalWealth, 2)} heat=${round(breakdown.heat, 2)} sources=${formatCounts(breakdown.positiveWealthDeltaBySource)}`
    ),
    "",
    "## Boost audit",
    `- Standalone boost command found: ${yesNo(d.boost.standaloneCommandFound)}`,
    `- Boost command names: ${d.boost.commandNames.join(", ") || "none"}`,
    `- UI-only mentions: ${d.boost.uiOnlyMentions}`,
    `- Boost-like actions: ${d.boost.buildingOrFactionBoostLikeActions.join(", ") || "none"}`,
    `- Conclusion: ${d.boost.conclusion}`,
    "",
    "## Top risks before closed alpha",
    ...aggregate.recommendations.slice(0, 8).map((item) => `- ${item}`),
    "",
    "## Recommended next changes",
    "- Add a readiness-aware alliance planner or early influence source before changing alliance rules again.",
    "- Add a focused conflict/bounty scenario with guaranteed adjacent target ownership to isolate combat and bounty balance from map pacing.",
    "- Mark late-game/expensive building special actions in config/read models so the planner and UI can distinguish locked content from broken wiring.",
    ""
  ];
  return `${lines.join("\n")}\n`;
};

const buildAggregateReport = (input: {
  reports: ClosedAlphaSimulationReport[];
  steps: number;
  playerCount: number;
  scenario: SimulationScenario;
  wallClockMs: number;
}): ClosedAlphaAggregateReport => {
  const runSummaries = input.reports.map((report) => {
    const topBehaviorStyle = maxEntry(report.diagnostics.snowball.wealthByBehavior)?.[0] ?? null;
    return {
      seed: report.config.seed,
      passed: report.passed,
      totalCommands: report.metrics.commands.totalSubmitted,
      rejectedRate: report.diagnostics.rejectedCommands.rejectedRate,
      attacks: report.metrics.combat.attacks,
      spyActions: report.metrics.spying.actions,
      spyToAttackConversionRate: report.diagnostics.conflict.spyToAttackConversionRate,
      bountyCreated: report.metrics.bounty.created,
      bountyClaimed: report.metrics.bounty.claimed,
      activeAlliances: report.metrics.alliances.activeAlliances.length,
      unusedSpecialActions: report.metrics.buildings.unusedSpecialActions.length,
      gini: report.metrics.fairness.giniWealth,
      topMedianWealthRatio: report.metrics.fairness.topToMedianWealthRatio,
      topPlayerByWealth: report.metrics.economy.top5ByWealth[0]?.playerId ?? null,
      topBehaviorStyle,
      topFaction: report.metrics.fairness.topFactionWealth?.factionId ?? null
    };
  });
  const metricValues: Record<string, number[]> = {
    totalCommands: input.reports.map((report) => report.metrics.commands.totalSubmitted),
    acceptedCommands: input.reports.map((report) => report.metrics.commands.successful),
    rejectedCommands: input.reports.map((report) => report.metrics.commands.rejected),
    rejectedRate: input.reports.map((report) => report.diagnostics.rejectedCommands.rejectedRate),
    skippedNotReadyActions: input.reports.map((report) => report.diagnostics.actionReadiness.skippedNotReadyActions),
    plannerAvoidableRejects: input.reports.map((report) => report.diagnostics.actionReadiness.plannerAvoidableRejects),
    trueServerRejects: input.reports.map((report) => report.diagnostics.actionReadiness.trueServerRejects),
    attacks: input.reports.map((report) => report.metrics.combat.attacks),
    successfulAttacks: input.reports.map((report) => report.metrics.combat.successfulAttacks),
    spyActions: input.reports.map((report) => report.metrics.spying.actions),
    spyToAttackConversionRate: input.reports.map((report) => report.diagnostics.conflict.spyToAttackConversionRate),
    bountyCreated: input.reports.map((report) => report.metrics.bounty.created),
    bountyClaimed: input.reports.map((report) => report.metrics.bounty.claimed),
    bountyClaimRate: input.reports.map((report) => report.diagnostics.bounty.claimRate),
    allianceRequests: input.reports.map((report) => report.metrics.alliances.createRequests + report.metrics.alliances.joinRequests + report.metrics.alliances.invitesSent),
    activeAlliances: input.reports.map((report) => report.metrics.alliances.activeAlliances.length),
    buildingSpecialActionsUsed: input.reports.map((report) => report.metrics.buildings.specialActions),
    unusedSpecialActionCount: input.reports.map((report) => report.metrics.buildings.unusedSpecialActions.length),
    policeRaidsTriggered: input.reports.map((report) => report.diagnostics.policeRaids.triggered),
    policeRaidsPendingFinal: input.reports.map((report) => report.diagnostics.policeRaids.pendingFinal),
    gini: input.reports.map((report) => report.metrics.fairness.giniWealth),
    topMedianWealthRatio: input.reports.map((report) => report.metrics.fairness.topToMedianWealthRatio)
  };
  const rejectedByReason = mergeCountRecords(input.reports.map((report) => report.diagnostics.rejectedCommands.byReason));
  const rejectedByCategory = mergeCountRecords(input.reports.map((report) => report.diagnostics.rejectedCommands.byCategory)) as Record<RejectionCategory, number>;
  const fakeRejectedAttempts = input.reports.flatMap((report) => report.commandAttemptsSample.filter((attempt) => !attempt.accepted));
  const totalRejectedCount = input.reports.reduce((total, report) => total + report.metrics.commands.rejected, 0);
  const topReasons = buildRejectedReasonSummaries(fakeRejectedAttempts, rejectedByReason, totalRejectedCount);
  const rejectedCommandAggregate = {
    byReason: rejectedByReason,
    byCategory: rejectedByCategory,
    topReasons
  };
  const topBehaviorStyles = countBy(runSummaries, (summary) => summary.topBehaviorStyle ?? "n/a");
  const topFactions = countBy(runSummaries, (summary) => summary.topFaction ?? "n/a");
  const runtimeErrors = input.reports.reduce((total, report) => total + report.metrics.stability.runtimeErrors, 0);
  const invariantViolations = input.reports.reduce((total, report) => total + report.invariantViolations.length, 0);
  return {
    name: "20-player mixed-behavior closed-alpha aggregate simulation",
    passed: input.reports.every((report) => report.passed),
    config: {
      steps: input.steps,
      playerCount: input.playerCount,
      scenario: input.scenario,
      seeds: input.reports.map((report) => report.config.seed)
    },
    runtime: {
      wallClockMs: Math.max(0, Math.round(input.wallClockMs)),
      passCount: input.reports.filter((report) => report.passed).length,
      failCount: input.reports.filter((report) => !report.passed).length,
      invariantViolations,
      runtimeErrors
    },
    metrics: Object.fromEntries(Object.entries(metricValues).map(([key, values]) => [key, statSummary(values)])),
    runSummaries,
    rejectedCommandAggregate,
    diagnostics: buildAggregateDiagnostics(input.reports, rejectedCommandAggregate),
    topBehaviorStyles,
    topFactions,
    reports: input.reports,
    recommendations: buildAggregateRecommendations(input.reports)
  };
};

const buildAggregateDiagnostics = (
  reports: ClosedAlphaSimulationReport[],
  rejectedCommands: ClosedAlphaAggregateDiagnostics["rejectedCommands"]
): ClosedAlphaAggregateDiagnostics => {
  const allianceDiagnostics = reports.map((report) => report.diagnostics.alliance);
  const actionReadinessDiagnostics = reports.map((report) => report.diagnostics.actionReadiness);
  const conflictDiagnostics = reports.map((report) => report.diagnostics.conflict);
  const bountyDiagnostics = reports.map((report) => report.diagnostics.bounty);
  const buildingDiagnostics = reports.map((report) => report.diagnostics.buildingSpecialCoverage);
  const snowballDiagnostics = reports.map((report) => report.diagnostics.snowball);
  const policeDiagnostics = reports.map((report) => report.diagnostics.policeRaids);
  const boostDiagnostics = reports.map((report) => report.diagnostics.boost);

  const buildingActionMap = new Map<string, ClosedAlphaAggregateDiagnostics["buildingSpecialCoverage"]["actions"][number]>();
  for (const report of reports) {
    for (const action of report.diagnostics.buildingSpecialCoverage.actions) {
      const key = `${action.buildingTypeId}:${action.actionId}`;
      const existing = buildingActionMap.get(key) ?? {
        buildingTypeId: action.buildingTypeId,
        actionId: action.actionId,
        runsUsed: 0,
        runsUnused: 0,
        totalUsedCount: 0,
        totalRejectedCount: 0,
        rejectionReasons: {},
        unusedCategories: {},
        everOwnedRequiredBuildingInAnyRun: false,
        availableInRegistryAllRuns: true,
        availableInTransportAllRuns: true,
        consideredByBehaviorEngineAllRuns: true,
        suggestedReason: ""
      };
      if (action.usedCount > 0) existing.runsUsed += 1;
      else existing.runsUnused += 1;
      existing.totalUsedCount += action.usedCount;
      existing.totalRejectedCount += action.rejectedCount;
      existing.rejectionReasons = mergeCountRecords([existing.rejectionReasons, action.rejectionReasons]);
      if (action.unusedCategory) increment(existing.unusedCategories, action.unusedCategory);
      existing.everOwnedRequiredBuildingInAnyRun ||= action.everOwnedRequiredBuilding;
      existing.availableInRegistryAllRuns &&= action.availableInRegistry;
      existing.availableInTransportAllRuns &&= action.availableInTransport;
      existing.consideredByBehaviorEngineAllRuns &&= action.consideredByBehaviorEngine;
      buildingActionMap.set(key, existing);
    }
  }
  for (const action of buildingActionMap.values()) {
    const topUnusedCategory = maxEntry(action.unusedCategories)?.[0] ?? null;
    action.suggestedReason = action.totalUsedCount > 0
      ? action.runsUnused > 0
        ? `Used in ${action.runsUsed} run(s), unused in ${action.runsUnused}; main unused cause: ${topUnusedCategory ?? "n/a"}.`
        : "Used in every aggregate run."
      : suggestedUnusedBuildingReason(topUnusedCategory, action.rejectionReasons);
  }

  const behaviorIds = uniqueSorted(snowballDiagnostics.flatMap((diagnostics) => Object.keys(diagnostics.wealthByBehavior)));
  const wealthByBehavior = Object.fromEntries(behaviorIds.map((behavior) => [
    behavior,
    statSummary(snowballDiagnostics.map((diagnostics) => diagnostics.wealthByBehavior[behavior] ?? 0))
  ]));
  const averageSpyAttackSteps = conflictDiagnostics
    .map((diagnostics) => diagnostics.averageStepsBetweenSpyAndAttack)
    .filter((value): value is number => typeof value === "number");
  const bountyConflictLift = bountyDiagnostics
    .map((diagnostics) => diagnostics.bountyConflictLift)
    .filter((value): value is number => typeof value === "number");

  return {
    actionReadiness: {
      submittedCommands: statSummary(actionReadinessDiagnostics.map((diagnostics) => diagnostics.submittedCommands)),
      skippedNotReadyActions: statSummary(actionReadinessDiagnostics.map((diagnostics) => diagnostics.skippedNotReadyActions)),
      rejectedCommands: statSummary(actionReadinessDiagnostics.map((diagnostics) => diagnostics.rejectedCommands)),
      plannerAvoidableRejects: statSummary(actionReadinessDiagnostics.map((diagnostics) => diagnostics.plannerAvoidableRejects)),
      trueServerRejects: statSummary(actionReadinessDiagnostics.map((diagnostics) => diagnostics.trueServerRejects)),
      skipReasons: mergeCountRecords(actionReadinessDiagnostics.map((diagnostics) => diagnostics.skipReasons)),
      plannerAvoidableRejectReasons: mergeCountRecords(actionReadinessDiagnostics.map((diagnostics) => diagnostics.plannerAvoidableRejectReasons)),
      trueServerRejectReasons: mergeCountRecords(actionReadinessDiagnostics.map((diagnostics) => diagnostics.trueServerRejectReasons))
    },
    rejectedCommands,
    alliance: {
      commandsAvailable: {
        createAlliance: allianceDiagnostics.every((diagnostics) => diagnostics.commandsAvailable.createAlliance),
        joinAlliance: allianceDiagnostics.every((diagnostics) => diagnostics.commandsAvailable.joinAlliance),
        inviteAllianceMember: allianceDiagnostics.every((diagnostics) => diagnostics.commandsAvailable.inviteAllianceMember),
        respondAllianceInvite: allianceDiagnostics.every((diagnostics) => diagnostics.commandsAvailable.respondAllianceInvite)
      },
      requiredInfluence: allianceDiagnostics[0]?.requiredInfluence ?? ALLIANCE_CREATE_REQUIRED_INFLUENCE,
      totalDiplomatAllianceAttempts: allianceDiagnostics.reduce((total, diagnostics) => total + diagnostics.diplomatAllianceAttempts, 0),
      totalRejectedAllianceCommands: allianceDiagnostics.reduce((total, diagnostics) => total + diagnostics.rejectedAllianceCommands, 0),
      rejectionReasons: mergeCountRecords(allianceDiagnostics.map((diagnostics) => diagnostics.rejectionReasons)),
      playersEverEligibleBySeed: Object.fromEntries(reports.map((report) => [report.config.seed, report.diagnostics.alliance.playersEverEligible])),
      maxInfluenceObserved: round(Math.max(0, ...allianceDiagnostics.flatMap((diagnostics) => Object.values(diagnostics.maxInfluenceByPlayer))), 2),
      readinessTimelineSample: reports.flatMap((report) =>
        report.diagnostics.alliance.readinessTimeline.slice(0, 20).map((entry) => ({
          ...entry,
          seed: report.config.seed
        }))
      ),
      conclusionCounts: countBy(allianceDiagnostics, (diagnostics) => diagnostics.conclusion),
      recommendations: uniqueSorted(allianceDiagnostics.flatMap((diagnostics) => diagnostics.recommendations))
    },
    conflict: {
      attackPrimaryIntentions: conflictDiagnostics.reduce((total, diagnostics) => total + diagnostics.attackPrimaryIntentions, 0),
      attackPlanFailures: conflictDiagnostics.reduce((total, diagnostics) => total + diagnostics.attackPlanFailures, 0),
      attackPlanFailureReasons: mergeCountRecords(conflictDiagnostics.map((diagnostics) => diagnostics.attackPlanFailureReasons)),
      submittedAttacks: conflictDiagnostics.reduce((total, diagnostics) => total + diagnostics.submittedAttacks, 0),
      acceptedAttacks: conflictDiagnostics.reduce((total, diagnostics) => total + diagnostics.acceptedAttacks, 0),
      rejectedAttacks: conflictDiagnostics.reduce((total, diagnostics) => total + diagnostics.rejectedAttacks, 0),
      rejectedAttackReasons: mergeCountRecords(conflictDiagnostics.map((diagnostics) => diagnostics.rejectedAttackReasons)),
      relevantSuccessfulSpies: conflictDiagnostics.reduce((total, diagnostics) => total + diagnostics.relevantSuccessfulSpies, 0),
      followUpAttacksAfterSpy: conflictDiagnostics.reduce((total, diagnostics) => total + diagnostics.followUpAttacksAfterSpy, 0),
      spyToAttackConversionRate: statSummary(conflictDiagnostics.map((diagnostics) => diagnostics.spyToAttackConversionRate)),
      averageStepsBetweenSpyAndAttack: statSummary(averageSpyAttackSteps),
      conclusionCounts: countBy(conflictDiagnostics, (diagnostics) => diagnostics.conclusion)
    },
    bounty: {
      created: bountyDiagnostics.reduce((total, diagnostics) => total + diagnostics.created, 0),
      claimed: bountyDiagnostics.reduce((total, diagnostics) => total + diagnostics.claimed, 0),
      claimRate: statSummary(bountyDiagnostics.map((diagnostics) => diagnostics.claimRate)),
      unclaimedReasons: mergeCountRecords(bountyDiagnostics.map((diagnostics) => diagnostics.unclaimedReasons)),
      attacksOnPlayersWithBounty: bountyDiagnostics.reduce((total, diagnostics) => total + diagnostics.attacksOnPlayersWithBounty, 0),
      attacksOnPlayersWithoutBounty: bountyDiagnostics.reduce((total, diagnostics) => total + diagnostics.attacksOnPlayersWithoutBounty, 0),
      bountyConflictLift: statSummary(bountyConflictLift),
      selfClaimAbuseDetectedRuns: bountyDiagnostics.filter((diagnostics) => diagnostics.selfClaimAbuseDetected).length,
      recordsSample: bountyDiagnostics.flatMap((diagnostics) => diagnostics.records).slice(0, 80),
      conclusionCounts: countBy(bountyDiagnostics, (diagnostics) => diagnostics.conclusion)
    },
    buildingSpecialCoverage: {
      totalConfigured: Math.max(0, ...buildingDiagnostics.map((diagnostics) => diagnostics.totalConfigured)),
      usedActionCount: statSummary(buildingDiagnostics.map((diagnostics) => diagnostics.usedActions)),
      unusedActionCount: statSummary(buildingDiagnostics.map((diagnostics) => diagnostics.unusedActions)),
      categories: mergeCountRecords(buildingDiagnostics.map((diagnostics) => diagnostics.categories)),
      actions: [...buildingActionMap.values()].sort((left, right) =>
        left.buildingTypeId.localeCompare(right.buildingTypeId) || left.actionId.localeCompare(right.actionId)
      )
    },
    snowball: {
      topPlayerBreakdowns: reports.map((report) => ({
        ...report.diagnostics.snowball.topPlayerBreakdown,
        seed: report.config.seed,
        conclusion: report.diagnostics.snowball.conclusion
      })),
      topSnowballMoments: reports.flatMap((report) =>
        report.diagnostics.snowball.topSnowballMoments.map((moment) => ({
          ...moment,
          seed: report.config.seed
        }))
      ).sort((left, right) => right.wealthDelta - left.wealthDelta).slice(0, 20),
      wealthByBehavior,
      wealthTimelinePoints: snowballDiagnostics.reduce((total, diagnostics) => total + diagnostics.wealthTimeline.length, 0),
      conclusionCounts: countBy(snowballDiagnostics, (diagnostics) => diagnostics.conclusion)
    },
    policeRaids: {
      triggered: statSummary(policeDiagnostics.map((diagnostics) => diagnostics.triggered)),
      resolved: statSummary(policeDiagnostics.map((diagnostics) => diagnostics.resolved)),
      expired: statSummary(policeDiagnostics.map((diagnostics) => diagnostics.expired)),
      pendingFinal: statSummary(policeDiagnostics.map((diagnostics) => diagnostics.pendingFinal)),
      bySeverity: mergeCountRecords(policeDiagnostics.map((diagnostics) => diagnostics.bySeverity)),
      maxOpenPendingRaids: statSummary(policeDiagnostics.map((diagnostics) => diagnostics.maxOpenPendingRaids)),
      dayLimit: policeDiagnostics[0]?.dayLimit ?? 2,
      nightLimit: policeDiagnostics[0]?.nightLimit ?? 1,
      conclusionCounts: countBy(policeDiagnostics, (diagnostics) => diagnostics.conclusion)
    },
    boost: {
      standaloneCommandFound: boostDiagnostics.some((diagnostics) => diagnostics.standaloneCommandFound),
      commandNames: uniqueSorted(boostDiagnostics.flatMap((diagnostics) => diagnostics.commandNames)),
      uiOnlyMentions: Math.max(0, ...boostDiagnostics.map((diagnostics) => diagnostics.uiOnlyMentions)),
      buildingOrFactionBoostLikeActions: uniqueSorted(boostDiagnostics.flatMap((diagnostics) => diagnostics.buildingOrFactionBoostLikeActions)),
      conclusion: boostDiagnostics.some((diagnostics) => diagnostics.standaloneCommandFound)
        ? "A standalone server-authoritative boost command was found in at least one run."
        : "No standalone server-authoritative boost command is routed. Boost-like effects exist as timed building special actions/effect modifiers.",
      smallestSafeDesign: boostDiagnostics[0]?.smallestSafeDesign ?? []
    }
  };
};

export const toStableJson = (value: unknown): string => `${stableJsonValue(value)}\n`;

const finalizeMetrics = (
  state: MutableSimulationState,
  finalResources: Record<string, ResourceSummary>
): void => {
  const metrics = state.metrics;
  const runtimeState = getRuntime(state.server).state;
  metrics.commands.averageCommandsPerPlayer = round(metrics.commands.totalSubmitted / Math.max(1, state.players.length), 2);
  metrics.commands.mostActivePlayer = maxEntry(metrics.commands.byPlayer)?.[0] ?? null;
  metrics.commands.leastActivePlayer = minEntry(state.players.reduce<Record<string, number>>((counts, player) => {
    counts[player.id] = metrics.commands.byPlayer[player.id] ?? 0;
    return counts;
  }, {}))?.[0] ?? null;
  metrics.combat.mostFrequentAttacker = maxEntry(metrics.combat.attacksByPlayer)?.[0] ?? null;
  metrics.combat.mostFrequentVictim = maxEntry(metrics.combat.victimsByPlayer)?.[0] ?? null;
  metrics.spying.mostFrequentTarget = maxEntry(metrics.spying.targetCounts)?.[0] ?? null;
  const districtCounts = Object.values(runtimeState.districtsById)
    .filter((district) => district.ownerPlayerId && district.status !== "destroyed")
    .reduce<Record<string, number>>((counts, district) => {
      increment(counts, district.ownerPlayerId!);
      return counts;
    }, {});
  const districtCountValues = Object.values(districtCounts).sort((left, right) => right - left);
  const ownedDistrictCount = districtCountValues.reduce((sum, count) => sum + count, 0);
  metrics.combat.top1DistrictShare = round((districtCountValues[0] ?? 0) / Math.max(1, ownedDistrictCount), 4);
  metrics.combat.top3DistrictShare = round(
    districtCountValues.slice(0, 3).reduce((sum, count) => sum + count, 0) / Math.max(1, ownedDistrictCount),
    4
  );

  const acceptedAttackAttempts = state.commandAttempts
    .filter((attempt) => attempt.accepted && !attempt.duplicateReplay && attempt.commandType === "attack-district")
    .sort((left, right) => left.tick - right.tick || left.commandId.localeCompare(right.commandId));
  const attackIntervals = acceptedAttackAttempts.slice(1)
    .map((attempt, index) => attempt.tick - acceptedAttackAttempts[index]!.tick)
    .filter((interval) => interval >= 0);
  metrics.combat.averageAttackIntervalTicks = round(average(attackIntervals), 2);

  const conflictCommandTypes = new Set([
    "attack-district", "spy-district", "heist-district", "rob-district",
    "occupy-district", "place-defense", "remove-defense", "place-trap", "relocate-trap"
  ]);
  const conflictCommandsByTick = acceptedAttackAttempts.length === 0 && state.commandAttempts.length === 0
    ? {}
    : state.commandAttempts
        .filter((attempt) => attempt.accepted && !attempt.duplicateReplay && conflictCommandTypes.has(attempt.commandType))
        .reduce<Record<string, number>>((counts, attempt) => {
          increment(counts, String(attempt.tick));
          return counts;
        }, {});
  metrics.combat.simultaneousConflictCommands = Object.values(conflictCommandsByTick)
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count, 0);

  for (const player of state.players) {
    const attacks = acceptedAttackAttempts.filter((attempt) => attempt.playerId === player.id);
    for (let index = 1; index < attacks.length; index += 1) {
      const previous = attacks[index - 1]!;
      const current = attacks[index]!;
      const deadline = previous.attackGlobalCooldownUntilTick ?? previous.tick;
      if (current.tick < deadline) {
        state.invariantViolations.push(
          `${player.id} executed an attack at tick ${current.tick} before global cooldown ${deadline}.`
        );
      }
    }
  }

  metrics.alliances.activeAlliances = Object.values(runtimeState.alliancesById)
    .filter((alliance) => alliance.status === "active")
    .map((alliance) => ({
      allianceId: alliance.id,
      name: alliance.name,
      members: [...alliance.memberIds]
    }));

  const usedBuildingEntries = Object.entries(metrics.buildings.specialActionsByType);
  metrics.buildings.mostUsedBuilding = maxEntry(metrics.buildings.specialActionsByType)?.[0] ?? null;
  metrics.buildings.leastUsedBuilding = usedBuildingEntries.length ? minEntry(metrics.buildings.specialActionsByType)?.[0] ?? null : null;
  const usedActionKeys = new Set(Object.keys(metrics.buildings.specialActionsByAction));
  metrics.buildings.unusedSpecialActions = metrics.buildings.availableSpecialActions.filter((action) => !usedActionKeys.has(action.actionId));

  const startTotals = sumResourceSummaries(state.initialResources);
  const finalTotals = sumResourceSummaries(finalResources);
  metrics.economy.cleanCashDelta = round(finalTotals.cleanCash - startTotals.cleanCash, 2);
  metrics.economy.dirtyCashDelta = round(finalTotals.dirtyCash - startTotals.dirtyCash, 2);
  metrics.economy.influenceDelta = round(finalTotals.influence - startTotals.influence, 2);
  metrics.economy.heatDelta = round(finalTotals.heat - startTotals.heat, 2);
  metrics.economy.materialsDelta = round(finalTotals.materials - startTotals.materials, 2);
  metrics.economy.totalStartingWealth = round(sumWealth(Object.values(state.initialResources)), 2);
  metrics.economy.totalFinalWealth = round(sumWealth(Object.values(finalResources)), 2);
  const growthByPlayer = state.players.map((player) => wealth(finalResources[player.id]!) - wealth(state.initialResources[player.id]!));
  metrics.economy.averageGrowth = round(average(growthByPlayer), 2);
  metrics.economy.medianGrowth = round(median(growthByPlayer), 2);
  const wealthRows = state.players
    .map((player) => ({ playerId: player.id, wealth: round(wealth(finalResources[player.id]!), 2) }))
    .sort((left, right) => right.wealth - left.wealth);
  metrics.economy.top5ByWealth = wealthRows.slice(0, 5);
  metrics.economy.bottom5ByWealth = wealthRows.slice(-5).reverse();

  for (const player of state.players) {
    const summary = finalResources[player.id]!;
    for (const [resourceId, amount] of Object.entries(summary.rawBalances)) {
      if (!Number.isFinite(amount)) {
        state.invariantViolations.push(`${player.id} resource ${resourceId} is not finite: ${amount}.`);
      }
      if (amount < 0) {
        metrics.economy.invalidNegativeBalances.push({ playerId: player.id, resourceId, amount });
      }
    }
  }
  if (metrics.economy.invalidNegativeBalances.length > 0) {
    state.invariantViolations.push(`Negative resource balances detected: ${metrics.economy.invalidNegativeBalances.length}.`);
  }

  const heatRows = Object.entries(finalResources).map(([playerId, summary]) => ({ playerId, heat: summary.heat }));
  metrics.heatRisk.averageHeat = round(average(heatRows.map((entry) => entry.heat)), 2);
  const maxHeat = heatRows.sort((left, right) => right.heat - left.heat)[0];
  metrics.heatRisk.maxHeat = round(maxHeat?.heat ?? 0, 2);
  metrics.heatRisk.highestHeatPlayer = maxHeat?.playerId ?? null;

  metrics.stability.invariantViolations = state.invariantViolations.length;
  metrics.stability.invalidStates = metrics.economy.invalidNegativeBalances.length;
  metrics.stability.completed = true;

  const wealthValues = wealthRows.map((row) => row.wealth);
  metrics.fairness.giniWealth = round(gini(wealthValues), 4);
  const medianWealth = median(wealthValues);
  metrics.fairness.topToMedianWealthRatio = round((wealthValues[0] ?? 0) / Math.max(1, medianWealth), 2);
  const wealthByFaction = state.players.reduce<Record<string, number>>((totals, player) => {
    totals[player.factionId] = (totals[player.factionId] ?? 0) + wealth(finalResources[player.id]!);
    return totals;
  }, {});
  const topFaction = maxEntry(wealthByFaction);
  const bottomFaction = minEntry(wealthByFaction);
  metrics.fairness.topFactionWealth = topFaction ? { factionId: topFaction[0], wealth: round(topFaction[1], 2) } : null;
  metrics.fairness.bottomFactionWealth = bottomFaction ? { factionId: bottomFaction[0], wealth: round(bottomFaction[1], 2) } : null;
  metrics.fairness.behaviorSuccessRates = state.players.reduce<Record<string, { submitted: number; accepted: number; successRate: number }>>((rates, player) => {
    const current = rates[player.behavior] ?? { submitted: 0, accepted: 0, successRate: 0 };
    current.submitted += metrics.commands.byPlayer[player.id] ?? 0;
    current.accepted += metrics.commands.acceptedByPlayer[player.id] ?? 0;
    current.successRate = round(current.accepted / Math.max(1, current.submitted), 3);
    rates[player.behavior] = current;
    return rates;
  }, {});
  metrics.fairness.dominantBehaviorWarning = detectDominantBehavior(state, finalResources);
  metrics.fairness.dominantFactionWarning = detectDominantFaction(metrics);
};

const buildDiagnostics = (
  state: MutableSimulationState,
  finalResources: Record<string, ResourceSummary>,
  rawEventCounters: Record<string, number> = {}
): ClosedAlphaDiagnostics => {
  const rejectedAttempts = state.commandAttempts.filter((attempt) => !attempt.accepted);
  const rejectedByReason = countBy(rejectedAttempts.flatMap((attempt) => attempt.errors.length ? attempt.errors : ["unknown"]), (reason) => reason);
  const rejectedByCategory = emptyRejectionCategoryCounts();
  for (const attempt of rejectedAttempts) {
    const categories = attempt.rejectionCategories.length ? attempt.rejectionCategories : ["unknown" as RejectionCategory];
    for (const category of categories) increment(rejectedByCategory, category);
  }

  return {
    actionReadiness: buildActionReadinessDiagnostics(state, rejectedAttempts),
    rejectedCommands: {
      totalRejected: rejectedAttempts.length,
      rejectedRate: round(rejectedAttempts.length / Math.max(1, state.commandAttempts.length), 4),
      byCommandType: countBy(rejectedAttempts, (attempt) => attempt.commandType),
      byBehavior: countBy(rejectedAttempts, (attempt) => attempt.behavior),
      byFaction: countBy(rejectedAttempts, (attempt) => attempt.factionId),
      byReason: rejectedByReason,
      byCategory: rejectedByCategory,
      topReasons: buildRejectedReasonSummaries(rejectedAttempts, rejectedByReason)
    },
    alliance: buildAllianceDiagnostics(state, finalResources),
    conflict: buildConflictDiagnostics(state),
    bounty: buildBountyDiagnostics(state),
    bountyOpportunityFunnel: buildBountyOpportunityFunnel(state),
    buildingSpecialCoverage: buildBuildingSpecialCoverage(state),
    spyFollowUpQueue: buildSpyFollowUpQueueDiagnostics(state),
    snowball: buildSnowballDiagnostics(state, finalResources),
    policeRaids: buildPoliceRaidDiagnostics(state, rawEventCounters),
    boost: buildBoostDiagnostics()
  };
};

const buildActionReadinessDiagnostics = (
  state: MutableSimulationState,
  rejectedAttempts: CommandAttemptAudit[]
): ClosedAlphaDiagnostics["actionReadiness"] => {
  const skipReasons = countBy(state.readinessSkips, (skip) => skip.readiness.reasonCode);
  const skipReasonsByBehavior = state.readinessSkips.reduce<Record<string, Record<string, number>>>((totals, skip) => {
    const record = totals[skip.behavior] ?? {};
    increment(record, skip.readiness.reasonCode);
    totals[skip.behavior] = record;
    return totals;
  }, {});
  const plannerAvoidableRejects = rejectedAttempts.filter((attempt) =>
    attempt.expectedRejection === false
    && attempt.errors.some((error) => isPlannerAvoidableRejectCode(error))
  );
  const trueServerRejects = rejectedAttempts.filter((attempt) =>
    !plannerAvoidableRejects.includes(attempt)
    && !attempt.expectedRejection
  );
  return {
    submittedCommands: state.commandAttempts.length,
    skippedNotReadyActions: state.readinessSkips.length,
    rejectedCommands: rejectedAttempts.length,
    plannerAvoidableRejects: plannerAvoidableRejects.length,
    trueServerRejects: trueServerRejects.length,
    skipReasons,
    skipReasonsByBehavior,
    plannerAvoidableRejectReasons: countBy(plannerAvoidableRejects.flatMap((attempt) => attempt.errors.length ? attempt.errors : ["unknown"]), (reason) => reason),
    trueServerRejectReasons: countBy(trueServerRejects.flatMap((attempt) => attempt.errors.length ? attempt.errors : ["unknown"]), (reason) => reason)
  };
};

const buildRejectedReasonSummaries = (
  rejectedAttempts: CommandAttemptAudit[],
  rejectedByReason: Record<string, number>,
  totalRejectedCount = rejectedAttempts.length
): RejectedReasonSummary[] => {
  const total = Math.max(1, totalRejectedCount);
  return Object.entries(rejectedByReason)
    .map(([reason, count]) => {
      const affected = rejectedAttempts.filter((attempt) => attempt.errors.includes(reason) || (attempt.errors.length === 0 && reason === "unknown"));
      return {
        reason,
        category: classifyRejectionCode(reason),
        count,
        percentage: round((count / total) * 100, 2),
        affectedCommandTypes: Object.keys(countBy(affected, (attempt) => attempt.commandType)).sort(),
        affectedBehaviors: Object.keys(countBy(affected, (attempt) => attempt.behavior)).sort(),
        suggestedFix: suggestedFixForRejection(reason)
      };
    })
    .sort((left, right) => right.count - left.count);
};

const buildAllianceDiagnostics = (
  state: MutableSimulationState,
  finalResources: Record<string, ResourceSummary>
): ClosedAlphaDiagnostics["alliance"] => {
  const allianceAttempts = state.commandAttempts.filter((attempt) => attempt.actionKind === "alliance");
  const allianceCreateAttempts = allianceAttempts.filter((attempt) => attempt.commandType === "create-alliance");
  const rejectedAllianceAttempts = allianceAttempts.filter((attempt) => !attempt.accepted);
  const allianceSkips = state.readinessSkips.filter((skip) => skip.actionKind === "alliance");
  const insufficientInfluenceSkips = allianceSkips.filter((skip) => skip.readiness.reasonCode === "alliance.waiting_for_influence");
  const maxInfluenceByPlayer = state.players.reduce<Record<string, number>>((record, player) => {
    const attemptInfluence = state.commandAttempts
      .filter((attempt) => attempt.playerId === player.id)
      .flatMap((attempt) => [attempt.resourcesBefore.influence, attempt.resourcesAfter.influence]);
    record[player.id] = round(Math.max(
      state.initialResources[player.id]?.influence ?? 0,
      finalResources[player.id]?.influence ?? 0,
      ...attemptInfluence
    ), 2);
    return record;
  }, {});
  const playersEverEligible = Object.entries(maxInfluenceByPlayer)
    .filter(([, influence]) => influence >= ALLIANCE_CREATE_REQUIRED_INFLUENCE)
    .map(([playerId]) => playerId);
  const rejectedReasons = countBy(rejectedAllianceAttempts.flatMap((attempt) => attempt.errors.length ? attempt.errors : ["unknown"]), (reason) => reason);
  const firstEligibleStep = Math.min(
    Number.POSITIVE_INFINITY,
    ...state.commandAttempts
      .filter((attempt) => attempt.resourcesBefore.influence >= ALLIANCE_CREATE_REQUIRED_INFLUENCE || attempt.resourcesAfter.influence >= ALLIANCE_CREATE_REQUIRED_INFLUENCE)
      .map((attempt) => attempt.step),
    ...state.readinessSkips
      .filter((skip) => (skip.readiness.currentAmount ?? 0) >= ALLIANCE_CREATE_REQUIRED_INFLUENCE)
      .map((skip) => skip.step)
  );
  const timeline = [
    ...allianceSkips.map((skip) => ({
      step: skip.step,
      playerId: skip.playerId,
      behavior: skip.behavior,
      influence: skip.readiness.currentAmount ?? summarizePlayerResources(getRuntime(state.server).state, skip.playerId).influence,
      cleanCash: summarizePlayerResources(getRuntime(state.server).state, skip.playerId).cleanCash,
      meetsInfluenceRequirement: Number(skip.readiness.currentAmount ?? 0) >= ALLIANCE_CREATE_REQUIRED_INFLUENCE,
      attemptedAllianceAction: false,
      result: "not-submitted" as const,
      errors: [skip.readiness.reasonCode],
      readinessState: skip.readiness.reasonCode === "alliance.waiting_for_influence" ? "waiting_for_influence" as const : "blocked" as const,
      estimatedStepsToReady: estimateStepsToInfluenceReady(state, skip.playerId, skip.readiness.currentAmount ?? 0)
    })),
    ...state.actionPlanFailures
      .filter((failure) => failure.actionKind === "alliance")
      .map((failure) => ({
        step: failure.step,
        playerId: failure.playerId,
        behavior: failure.behavior,
        influence: failure.influence,
        cleanCash: failure.cleanCash,
        meetsInfluenceRequirement: failure.influence >= ALLIANCE_CREATE_REQUIRED_INFLUENCE,
        attemptedAllianceAction: false,
        result: "not-submitted" as const,
        errors: Object.keys(failure.disabledReasonCounts),
        readinessState: failure.influence >= ALLIANCE_CREATE_REQUIRED_INFLUENCE ? "ready" as const : "waiting_for_influence" as const,
        estimatedStepsToReady: estimateStepsToInfluenceReady(state, failure.playerId, failure.influence)
      })),
    ...allianceAttempts.map((attempt) => ({
      step: attempt.step,
      playerId: attempt.playerId,
      behavior: attempt.behavior,
      influence: attempt.resourcesBefore.influence,
      cleanCash: attempt.resourcesBefore.cleanCash,
      meetsInfluenceRequirement: attempt.resourcesBefore.influence >= ALLIANCE_CREATE_REQUIRED_INFLUENCE,
      attemptedAllianceAction: true,
      result: attempt.accepted ? "accepted" as const : "rejected" as const,
      errors: attempt.errors,
      readinessState: "submitted" as const,
      estimatedStepsToReady: null
    }))
  ].sort((left, right) => left.step - right.step || left.playerId.localeCompare(right.playerId));
  const insufficient = rejectedReasons.ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE ?? 0;
  const conclusion = allianceAttempts.length === 0
    ? "Behavior engine did not submit alliance commands in this run."
    : insufficient === rejectedAllianceAttempts.length && rejectedAllianceAttempts.length > 0
      ? `Alliance creation is wired, but attempts happen before players reach ${ALLIANCE_CREATE_REQUIRED_INFLUENCE} influence.`
      : state.metrics.alliances.activeAlliances.length === 0
        ? "Alliance commands are wired, but this run did not progress from creation attempts to active memberships."
        : "Alliance flow produced active alliances in this run.";
  return {
    commandsAvailable: {
      createAlliance: true,
      joinAlliance: true,
      inviteAllianceMember: true,
      respondAllianceInvite: true
    },
    requiresInfluence: true,
    requiredInfluence: ALLIANCE_CREATE_REQUIRED_INFLUENCE,
    allianceCreateIntentions: state.primaryActionIntentions.alliance ?? 0,
    allianceCreateSkippedNotEnoughInfluence: insufficientInfluenceSkips.length,
    allianceCreateSubmitted: allianceCreateAttempts.length,
    allianceCreateAccepted: allianceCreateAttempts.filter((attempt) => attempt.accepted).length,
    allianceCreateRejected: allianceCreateAttempts.filter((attempt) => !attempt.accepted).length,
    allianceReadyButNotSubmitted: Math.max(0, timeline.filter((row) =>
      row.meetsInfluenceRequirement && !row.attemptedAllianceAction
    ).length),
    firstAllianceReadyStep: Number.isFinite(firstEligibleStep) ? firstEligibleStep : null,
    firstAllianceCreatedStep: allianceCreateAttempts.find((attempt) => attempt.accepted)?.step ?? null,
    diplomatAllianceAttempts: allianceAttempts.filter((attempt) => attempt.behavior === "diplomat_alliance").length,
    rejectedAllianceCommands: rejectedAllianceAttempts.length,
    rejectionReasons: rejectedReasons,
    maxInfluenceByPlayer,
    playersEverEligible,
    readinessTimeline: timeline,
    conclusion,
    recommendations: [
      "Make diplomat bots wait until influence is close to the requirement before submitting create-alliance.",
      "Consider early passive influence or a first-alliance discount if alliances should appear during the first session.",
      "Expose alliance readiness in the UI/read model so players see why the create button is locked."
    ]
  };
};

const buildConflictDiagnostics = (state: MutableSimulationState): ClosedAlphaDiagnostics["conflict"] => {
  const attackAttempts = state.commandAttempts.filter((attempt) => attempt.commandType === "attack-district");
  const attackReadinessSkips = state.readinessSkips.filter((skip) => skip.actionKind === "attack");
  const acceptedFollowUps = state.followUpAttackAudits.filter((followUp) =>
    state.commandAttempts.some((attempt) => attempt.commandId === followUp.attackCommandId && attempt.accepted)
  );
  const attackPlanFailures = state.actionPlanFailures.filter((failure) => failure.actionKind === "attack");
  const attackFailureReasons = attackPlanFailures.reduce<Record<string, number>>((counts, failure) => {
    const reasons = Object.keys(failure.disabledReasonCounts);
    if (reasons.length === 0) increment(counts, "no_attack_targets_in_frontier");
    for (const reason of reasons) increment(counts, reason, failure.disabledReasonCounts[reason] ?? 1);
    return counts;
  }, {});
  const rejectedAttackReasons = countBy(
    attackAttempts.filter((attempt) => !attempt.accepted).flatMap((attempt) => attempt.errors.length ? attempt.errors : ["unknown"]),
    (reason) => reason
  );
  const averageSteps = acceptedFollowUps.length
    ? round(average(acceptedFollowUps.map((entry) => Math.max(0, entry.attackStep - entry.spyStep))), 2)
    : null;
  const spyToAttackConversionRate = round(acceptedFollowUps.length / Math.max(1, state.successfulSpyIntel.length), 4);
  const conclusion = attackPlanFailures.length > attackAttempts.length
    ? "Conflict is primarily limited before submit: attack is often a primary intention, but no enabled attack target is exposed by the read model."
    : state.successfulSpyIntel.length > 0 && spyToAttackConversionRate < 0.15
      ? "Successful spy intel rarely converts into attack; spy prerequisite and follow-up targeting are the main bottleneck."
      : "Conflict density is mostly governed by behavior weights and cooldowns after valid targets exist.";
  return {
    attackPrimaryIntentions: state.primaryActionIntentions.attack ?? 0,
    attackPlanFailures: attackPlanFailures.length,
    attackReadinessSkipped: attackReadinessSkips.length,
    attackPlanFailureReasons: attackFailureReasons,
    submittedAttacks: attackAttempts.length,
    acceptedAttacks: attackAttempts.filter((attempt) => attempt.accepted).length,
    rejectedAttacks: attackAttempts.filter((attempt) => !attempt.accepted).length,
    successfulAttacks: state.metrics.combat.successfulAttacks,
    rejectedAttackReasons,
    spyAuthorizationsCreated: state.successfulSpyIntel.length,
    spyAuthorizationUsedByAttack: acceptedFollowUps.length,
    relevantSuccessfulSpies: state.successfulSpyIntel.length,
    followUpAttacksAfterSpy: acceptedFollowUps.length,
    spyToAttackConversionRate,
    averageStepsBetweenSpyAndAttack: averageSteps,
    plannedAttackFailureReasons: mergeCountRecords([
      attackFailureReasons,
      countBy(attackReadinessSkips, (skip) => skip.readiness.reasonCode)
    ]),
    conclusion
  };
};

const buildBountyDiagnostics = (state: MutableSimulationState): ClosedAlphaDiagnostics["bounty"] => {
  const bountyTargets = new Set(state.bountyAuditRecords.map((record) => record.targetPlayerId));
  const attackAttempts = state.commandAttempts.filter((attempt) => attempt.commandType === "attack-district" && attempt.targetPlayerId);
  const attacksOnPlayersWithBounty = attackAttempts.filter((attempt) => bountyTargets.has(attempt.targetPlayerId!)).length;
  const attacksOnPlayersWithoutBounty = attackAttempts.length - attacksOnPlayersWithBounty;
  const playerCountWithBounty = Math.max(1, bountyTargets.size);
  const playerCountWithoutBounty = Math.max(1, state.players.length - bountyTargets.size);
  const bountyAttackRate = attacksOnPlayersWithBounty / playerCountWithBounty;
  const normalAttackRate = attacksOnPlayersWithoutBounty / playerCountWithoutBounty;
  const unclaimedReasons = state.bountyAuditRecords.reduce<Record<string, number>>((counts, bounty) => {
    if (bounty.status === "claimed") return counts;
    const matchingAttack = attackAttempts.some((attempt) =>
      attempt.targetPlayerId === bounty.targetPlayerId
      && attempt.targetDistrictId === bounty.targetDistrictId
      && attempt.step >= bounty.createdStep
      && attempt.accepted
    );
    increment(counts, matchingAttack ? "matching_attack_did_not_satisfy_claim_rule" : "no_matching_successful_attack_or_capture");
    return counts;
  }, {});
  const claimRate = round(state.metrics.bounty.claimed / Math.max(1, state.metrics.bounty.created), 4);
  const targetsWithPath = state.bountyAuditRecords.filter((record) =>
    state.players.some((player) => player.id !== record.targetPlayerId && hasValidAttackPath(state, player.id, record.targetPlayerId))
  ).length;
  const bountyReadinessSkips = state.readinessSkips.filter((skip) => skip.actionKind === "bounty");
  const bountyAttempts = state.commandAttempts.filter((attempt) => attempt.actionKind === "bounty");
  return {
    records: state.bountyAuditRecords,
    created: state.metrics.bounty.created,
    claimed: state.metrics.bounty.claimed,
    claimRate,
    unclaimedReasons,
    attacksOnPlayersWithBounty,
    attacksOnPlayersWithoutBounty,
    bountyConflictLift: normalAttackRate > 0 ? round(bountyAttackRate / normalAttackRate, 3) : null,
    targetsWithValidAttackPath: targetsWithPath,
    targetsWithoutValidAttackPath: Math.max(0, state.bountyAuditRecords.length - targetsWithPath),
    claimAttemptIntentions: state.primaryActionIntentions.bounty ?? 0,
    claimSkippedNoValidAttack: bountyReadinessSkips.filter((skip) => /attack|target|path/.test(skip.readiness.reasonCode)).length,
    claimSubmitted: bountyAttempts.length,
    claimAccepted: bountyAttempts.filter((attempt) => attempt.accepted).length,
    claimRejected: bountyAttempts.filter((attempt) => !attempt.accepted).length,
    selfClaimAbuseDetected: state.metrics.bounty.selfClaimAbuseDetected,
    conclusion: state.metrics.bounty.created === 0
      ? "Bounty system was not exercised."
      : state.metrics.bounty.claimed === 0
        ? "Bounties are created but did not generate successful claimable attacks in this run."
        : "Bounties can be claimed, but conflict lift should be compared across multiple seeds before tuning rewards."
  };
};

const buildBountyOpportunityFunnel = (state: MutableSimulationState): ClosedAlphaDiagnostics["bountyOpportunityFunnel"] => {
  const diagnostics = buildBountyDiagnostics(state);
  return {
    bountyCreated: diagnostics.created,
    bountyTargetsWithValidAttackPath: diagnostics.targetsWithValidAttackPath,
    bountyTargetsWithoutValidAttackPath: diagnostics.targetsWithoutValidAttackPath,
    bountyClaimAttemptIntentions: diagnostics.claimAttemptIntentions,
    bountyClaimSkippedNoValidAttack: diagnostics.claimSkippedNoValidAttack,
    bountyClaimSubmitted: diagnostics.claimSubmitted,
    bountyClaimAccepted: diagnostics.claimAccepted,
    bountyClaimRejected: diagnostics.claimRejected,
    bountyClaimed: diagnostics.claimed,
    bountyConflictLift: diagnostics.bountyConflictLift,
    bountyUnclaimedReasons: diagnostics.unclaimedReasons
  };
};

const buildBuildingSpecialCoverage = (state: MutableSimulationState): ClosedAlphaDiagnostics["buildingSpecialCoverage"] => {
  const actionAttempts = state.commandAttempts.filter((attempt) => attempt.commandType === "run-building-action");
  const acceptedCoverage = state.specialCoverageAttempts.filter((attempt) => attempt.status === "accepted");
  const rejectedCoverage = state.specialCoverageAttempts.filter((attempt) => attempt.status === "rejected");
  const submittedCoverage = state.specialCoverageAttempts.filter((attempt) => attempt.status === "submitted" || attempt.status === "accepted" || attempt.status === "rejected");
  const rows = state.metrics.buildings.availableSpecialActions.map((action) => {
    const attempts = actionAttempts.filter((attempt) => attempt.buildingActionId === action.actionId);
    const coverageAttempts = state.specialCoverageAttempts.filter((attempt) =>
      attempt.buildingTypeId === action.buildingTypeId && attempt.actionId === action.actionId
    );
    const rejected = attempts.filter((attempt) => !attempt.accepted);
    const rejectionReasons = mergeCountRecords([
      countBy(rejected.flatMap((attempt) => attempt.errors.length ? attempt.errors : ["unknown"]), (reason) => reason),
      countBy(coverageAttempts.filter((attempt) => attempt.reasonCode), (attempt) => attempt.reasonCode ?? "unknown")
    ]);
    const usedCount = state.metrics.buildings.specialActionsByAction[action.actionId] ?? 0;
    const everOwnedRequiredBuilding = (state.ownedBuildingTypeCountsEver[action.buildingTypeId] ?? 0) > 0;
    const unusedCategory = usedCount > 0 ? null : classifyUnusedBuildingAction({
      everOwnedRequiredBuilding,
      attempts,
      rejectionReasons
    });
    return {
      buildingTypeId: action.buildingTypeId,
      actionId: action.actionId,
      usedCount,
      rejectedCount: rejected.length,
      rejectionReasons,
      everOwnedRequiredBuilding,
      availableInRegistry: true,
      availableInTransport: true,
      consideredByBehaviorEngine: true,
      unusedCategory,
      suggestedReason: suggestedUnusedBuildingReason(unusedCategory, rejectionReasons)
    };
  });
  return {
    totalConfigured: rows.length,
    reachableSpecialActions: rows.filter((row) => row.everOwnedRequiredBuilding && row.availableInRegistry && row.availableInTransport).length,
    submittedSpecialActions: submittedCoverage.length || actionAttempts.length,
    acceptedSpecialActions: acceptedCoverage.length || actionAttempts.filter((attempt) => attempt.accepted).length,
    rejectedSpecialActions: rejectedCoverage.length || actionAttempts.filter((attempt) => !attempt.accepted).length,
    trulyUnreachableSpecialActions: rows.filter((row) => !row.everOwnedRequiredBuilding || !row.availableInRegistry || !row.availableInTransport).length,
    behaviorIgnoredSpecialActions: rows.filter((row) => row.usedCount === 0 && row.unusedCategory === "not selected by behavior engine").length,
    usedActions: rows.filter((row) => row.usedCount > 0).length,
    unusedActions: rows.filter((row) => row.usedCount === 0).length,
    categories: countBy(rows.filter((row) => row.unusedCategory), (row) => row.unusedCategory ?? "used"),
    actions: rows
  };
};

const buildSpyFollowUpQueueDiagnostics = (state: MutableSimulationState): ClosedAlphaDiagnostics["spyFollowUpQueue"] => {
  const opportunities = state.spyFollowUpOpportunities;
  return {
    spySuccesses: state.successfulSpyIntel.length,
    opportunitiesCreated: opportunities.length,
    opportunitiesExpired: opportunities.filter((opportunity) => opportunity.status === "expired").length,
    attacksSubmitted: opportunities.filter((opportunity) => opportunity.attackCommandId !== null).length,
    attacksAccepted: opportunities.filter((opportunity) => opportunity.status === "accepted" || opportunity.status === "successful").length,
    attacksSuccessful: opportunities.filter((opportunity) => opportunity.status === "successful").length,
    blockedReasons: countBy(opportunities.filter((opportunity) => opportunity.blockedReason), (opportunity) => opportunity.blockedReason ?? "unknown"),
    openOpportunities: opportunities.filter((opportunity) => opportunity.status === "open").length
  };
};

const buildPoliceRaidDiagnostics = (
  state: MutableSimulationState,
  rawEventCounters: Record<string, number> = {}
): ClosedAlphaDiagnostics["policeRaids"] => {
  const runtimeState = getRuntime(state.server).state;
  const pendingRaids = Object.values(runtimeState.policeStatesById).flatMap((policeState) =>
    (policeState.pendingRaids ?? []).filter((raid) => raid.status === "pending" || raid.status === "acknowledged")
  );
  const policeEvents = Object.values(runtimeState.policeStatesById).flatMap((policeState) => policeState.policeEvents ?? []);
  const triggeredEvents = policeEvents.filter((event) => event.type === "police-raid-pending" || event.type === "police-raid-triggered");
  const resolvedEvents = policeEvents.filter((event) => event.type === "police-raid-resolved");
  const expiredEvents = policeEvents.filter((event) => event.type === "police-raid-expired");
  const config = getRuntime(state.server).config.balance.police ?? resolveModeConfig("free").balance.police;
  const dayLimit = config?.maxConcurrentRaidsByPhase.day ?? 2;
  const nightLimit = config?.maxConcurrentRaidsByPhase.night ?? 1;
  const triggered = rawEventCounters["police-raid-triggered"] ?? triggeredEvents.length;
  const resolved = rawEventCounters["police-raid-resolved"] ?? resolvedEvents.length;
  const expired = rawEventCounters["police-raid-expired"] ?? expiredEvents.length;

  return {
    dayLimit,
    nightLimit,
    triggered,
    resolved,
    expired,
    pendingFinal: pendingRaids.length,
    bySeverity: countBy([...triggeredEvents, ...pendingRaids], (entry) => String(entry.severity ?? "unknown")),
    byPlayer: countBy(pendingRaids, (raid) => raid.playerId),
    maxOpenPendingRaids: pendingRaids.length,
    conclusion: triggered > 0 || pendingRaids.length > 0
      ? `Police raids are active in simulation ticks; configured concurrency is day=${dayLimit}, night=${nightLimit}.`
      : `Police raid system is wired through ticks, but this run did not reach raid pressure. Configured concurrency is day=${dayLimit}, night=${nightLimit}.`
  };
};

const buildSnowballDiagnostics = (
  state: MutableSimulationState,
  finalResources: Record<string, ResourceSummary>
): ClosedAlphaDiagnostics["snowball"] => {
  const topPlayerId = state.metrics.economy.top5ByWealth[0]?.playerId ?? null;
  const topPlayer = topPlayerId ? state.players.find((player) => player.id === topPlayerId) ?? null : null;
  const topAttempts = topPlayerId ? state.commandAttempts.filter((attempt) => attempt.playerId === topPlayerId && attempt.accepted) : [];
  const positiveWealthDeltaByCommandType = topAttempts.reduce<Record<string, number>>((totals, attempt) => {
    if (attempt.resourceDelta.wealth > 0) increment(totals, attempt.commandType, round(attempt.resourceDelta.wealth, 2));
    return totals;
  }, {});
  const positiveWealthDeltaBySource = topAttempts.reduce<Record<string, number>>((totals, attempt) => {
    if (attempt.resourceDelta.wealth <= 0) return totals;
    increment(totals, sourceCategoryForCommand(attempt), round(attempt.resourceDelta.wealth, 2));
    return totals;
  }, {});
  const gainBy = (selector: (delta: ResourceDelta) => number) =>
    topAttempts.reduce<Record<string, number>>((totals, attempt) => {
      const gain = selector(attempt.resourceDelta);
      if (gain > 0) increment(totals, attempt.commandType, round(gain, 2));
      return totals;
    }, {});
  const wealthByBehavior = state.players.reduce<Record<string, number>>((totals, player) => {
    increment(totals, player.behavior, round(wealth(finalResources[player.id]!), 2));
    return totals;
  }, {});
  const wealthGainByPlayerSource = buildWealthGainByPlayerSource(state);
  const wealthGainByBehaviorSource = state.players.reduce<Record<string, Record<string, number>>>((totals, player) => {
    const sourceTotals = totals[player.behavior] ?? {};
    for (const [source, amount] of Object.entries(wealthGainByPlayerSource[player.id] ?? {})) {
      increment(sourceTotals, source, amount);
    }
    totals[player.behavior] = sourceTotals;
    return totals;
  }, {});
  const topIncomeSourcesOverall = Object.entries(mergeCountRecords(Object.values(wealthGainByPlayerSource)))
    .map(([source, amount]) => ({ source, amount: round(amount, 2) }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
  const topPlayersByNetWealthGain = state.players
    .map((player) => ({
      playerId: player.id,
      behavior: player.behavior,
      factionId: player.factionId,
      netWealthGain: round(wealth(finalResources[player.id]!) - wealth(state.initialResources[player.id]!), 2)
    }))
    .sort((left, right) => right.netWealthGain - left.netWealthGain)
    .slice(0, 5);
  const netGainByBehavior = state.players.reduce<Record<string, number>>((totals, player) => {
    increment(totals, player.behavior, wealth(finalResources[player.id]!) - wealth(state.initialResources[player.id]!));
    return totals;
  }, {});
  const netGainByFaction = state.players.reduce<Record<string, number>>((totals, player) => {
    increment(totals, player.factionId, wealth(finalResources[player.id]!) - wealth(state.initialResources[player.id]!));
    return totals;
  }, {});
  const topBehaviorGain = maxEntry(netGainByBehavior);
  const topFactionGain = maxEntry(netGainByFaction);
  const dominantSource = maxEntry(positiveWealthDeltaBySource)?.[0] ?? "unknown";
  return {
    wealthTimeline: state.wealthTimeline,
    topSnowballMoments: buildTopSnowballMoments(state),
    topPlayerBreakdown: {
      playerId: topPlayerId,
      behavior: topPlayer?.behavior ?? null,
      factionId: topPlayer?.factionId ?? null,
      finalWealth: topPlayerId ? round(wealth(finalResources[topPlayerId]!), 2) : 0,
      heat: topPlayerId ? finalResources[topPlayerId]?.heat ?? 0 : 0,
      positiveWealthDeltaByCommandType,
      positiveWealthDeltaBySource,
      cleanCashGainByCommandType: gainBy((delta) => delta.cleanCash),
      dirtyCashGainByCommandType: gainBy((delta) => delta.dirtyCash),
      influenceGainByCommandType: gainBy((delta) => delta.influence)
    },
    wealthByBehavior,
    wealthGainByPlayerSource,
    wealthGainByBehaviorSource,
    topIncomeSourcesOverall,
    topPlayersByNetWealthGain,
    topBehaviorByNetWealthGain: topBehaviorGain ? { behavior: topBehaviorGain[0], netWealthGain: round(topBehaviorGain[1], 2) } : null,
    topFactionByNetWealthGain: topFactionGain ? { factionId: topFactionGain[0], netWealthGain: round(topFactionGain[1], 2) } : null,
    conclusion: topPlayer
      ? `${topPlayer.id} (${topPlayer.behavior}) leads mainly through ${dominantSource}; compare this with heat ${round(finalResources[topPlayer.id]?.heat ?? 0)} to judge whether risk is high enough.`
      : "No top player was available for snowball analysis."
  };
};

const buildBoostDiagnostics = (): ClosedAlphaDiagnostics["boost"] => {
  const actions = Object.values(resolveModeConfig("free").balance.buildingActions ?? {})
    .map((action) => action.actionId)
    .filter((actionId) => /boost|overdrive|party|feed|course|window|channel|vip|protocol/iu.test(actionId))
    .sort();
  return {
    standaloneCommandFound: false,
    commandNames: [],
    uiOnlyMentions: 1,
    buildingOrFactionBoostLikeActions: actions,
    conclusion: "No standalone server-authoritative boost command is routed. Boost-like effects exist as timed building special actions/effect modifiers.",
    smallestSafeDesign: [
      "Add a server-authoritative use-boost command with commandId idempotency through the existing command ingress.",
      "Limit the first closed-alpha boost to a small non-stacking timed effect, for example +5% production for 10 minutes.",
      "Store cooldown/effect in effect state, reject stacking, and expose remaining duration in the read model."
    ]
  };
};

const validateInitialResources = (
  players: SimulationPlayer[],
  initialResources: Record<string, ResourceSummary>,
  invariantViolations: string[]
): void => {
  if (players.length !== DEFAULT_PLAYER_COUNT) {
    invariantViolations.push(`Expected exactly ${DEFAULT_PLAYER_COUNT} players, got ${players.length}.`);
  }
  for (const player of players) {
    const summary = initialResources[player.id];
    if (!summary) {
      invariantViolations.push(`Missing initial resource summary for ${player.id}.`);
      continue;
    }
    if (!matchesStartingResources(summary)) {
      invariantViolations.push(`${player.id} initial resources were ${resourceTuple(summary)}, expected 5000/1000/0/0/0.`);
    }
  }
};

const validateRuntimeState = (state: MutableSimulationState): void => {
  const runtimeState = getRuntime(state.server).state;
  const addViolation = (message: string) => {
    if (!state.invariantViolations.includes(message)) state.invariantViolations.push(message);
  };
  for (const player of state.players) {
    const summary = summarizePlayerResources(runtimeState, player.id);
    for (const [key, value] of Object.entries({
      cleanCash: summary.cleanCash,
      dirtyCash: summary.dirtyCash,
      influence: summary.influence,
      heat: summary.heat,
      materials: summary.materials
    })) {
      if (!Number.isFinite(value)) {
        addViolation(`${player.id} ${key} is not finite.`);
      }
    }
  }

  const contributedByDistrictItem = new Map<string, number>();
  for (const contribution of Object.values(runtimeState.allianceDefenseContributionsById ?? {})) {
    const amounts = [
      contribution.originalAmount,
      contribution.remainingAmount,
      contribution.lostAmount,
      contribution.returnedAmount
    ];
    if (amounts.some((amount) => !Number.isInteger(amount) || amount < 0)) {
      addViolation(`Defense contribution ${contribution.id} contains an invalid amount.`);
    }
    if (contribution.originalAmount !== contribution.remainingAmount + contribution.lostAmount + contribution.returnedAmount) {
      addViolation(`Defense contribution ${contribution.id} violates amount conservation.`);
    }
    const key = `${contribution.districtId}:${contribution.itemId}`;
    contributedByDistrictItem.set(key, (contributedByDistrictItem.get(key) ?? 0) + contribution.remainingAmount);
  }
  for (const [key, contributedAmount] of contributedByDistrictItem) {
    const separator = key.lastIndexOf(":");
    const districtId = key.slice(0, separator);
    const itemId = key.slice(separator + 1);
    const deployedLoadout = runtimeState.districtsById[districtId]?.defenseLoadout as Record<string, number> | undefined;
    const deployedAmount = Number(deployedLoadout?.[itemId] ?? 0);
    if (contributedAmount > deployedAmount) {
      addViolation(`Defense ledger ${key} has ${contributedAmount} remaining but only ${deployedAmount} deployed.`);
    }
  }

  for (const district of Object.values(runtimeState.districtsById)) {
    const pool = district.neutralLootPool;
    if (!pool) continue;
    if (pool.cash < 0 || pool.cash > pool.initialCash || pool.dirtyCash < 0 || pool.dirtyCash > pool.initialDirtyCash) {
      addViolation(`Neutral loot pool ${district.id} exceeded its cash bounds.`);
    }
    for (const [resourceId, amount] of Object.entries(pool.resources)) {
      if (amount < 0 || amount > Number(pool.initialResources[resourceId] ?? 0)) {
        addViolation(`Neutral loot pool ${district.id}:${resourceId} exceeded its seeded cap.`);
      }
    }
  }

  const activeTrapOwners = Object.values(runtimeState.trapsById)
    .filter((trap) => trap.status === "active")
    .reduce<Record<string, number>>((counts, trap) => {
      increment(counts, trap.ownerPlayerId);
      return counts;
    }, {});
  for (const [playerId, count] of Object.entries(activeTrapOwners)) {
    if (count > 1) addViolation(`${playerId} owns ${count} simultaneous active traps.`);
  }
};

const createEmptyMetrics = (
  availableSpecialActions: Array<{ buildingTypeId: string; actionId: string }>
): ClosedAlphaMetrics => ({
  commands: {
    totalSubmitted: 0,
    successful: 0,
    rejected: 0,
    errors: 0,
    duplicateOrIdempotent: 0,
    payloadConflicts: 0,
    expectedRejectionProbes: 0,
    averageCommandsPerPlayer: 0,
    mostActivePlayer: null,
    leastActivePlayer: null,
    byType: {},
    rejectedByCode: {},
    byPlayer: {},
    acceptedByPlayer: {}
  },
  combat: {
    attacks: 0,
    successfulAttacks: 0,
    failedAttacks: 0,
    attacksByPlayer: {},
    attacksByFaction: {},
    mostFrequentAttacker: null,
    mostFrequentVictim: null,
    victimsByPlayer: {},
    attacksOnAllies: 0,
    heists: 0,
    robs: 0,
    occupations: 0,
    damageOrLossEvents: 0,
    defensePlacements: 0,
    alliedDefensePlacements: 0,
    trapPlacements: 0,
    top1DistrictShare: 0,
    top3DistrictShare: 0,
    maxConsecutiveCaptureStreak: 0,
    averageAttackIntervalTicks: 0,
    attackerOccupationLosses: 0,
    capturedDefenseTransferViolations: 0,
    simultaneousConflictCommands: 0,
    offlinePlayerActions: 0
  },
  spying: {
    actions: 0,
    success: 0,
    partial: 0,
    failed: 0,
    byPlayer: {},
    targetCounts: {},
    mostFrequentTarget: null,
    invalidInformationLeaks: 0
  },
  alliances: {
    createRequests: 0,
    joinRequests: 0,
    invitesSent: 0,
    acceptedInvites: 0,
    rejectedInvites: 0,
    disbanded: 0,
    attacksOnAllies: 0,
    activeAlliances: []
  },
  bounty: {
    created: 0,
    claimed: 0,
    expired: 0,
    cancelled: 0,
    totalValue: 0,
    largestBounty: 0,
    byCreator: {},
    byTarget: {},
    selfClaimAbuseDetected: false
  },
  buildings: {
    built: 0,
    upgrades: 0,
    specialActions: 0,
    specialActionsByType: {},
    specialActionsByAction: {},
    cooldownViolations: 0,
    invalidSpecialAttempts: 0,
    mostUsedBuilding: null,
    leastUsedBuilding: null,
    availableSpecialActions,
    unusedSpecialActions: []
  },
  economy: {
    cleanCashDelta: 0,
    dirtyCashDelta: 0,
    influenceDelta: 0,
    heatDelta: 0,
    materialsDelta: 0,
    totalStartingWealth: 0,
    totalFinalWealth: 0,
    averageGrowth: 0,
    medianGrowth: 0,
    top5ByWealth: [],
    bottom5ByWealth: [],
    invalidNegativeBalances: [],
    marketBuys: 0,
    marketSells: 0,
    collects: 0
  },
  heatRisk: {
    averageHeat: 0,
    maxHeat: 0,
    highestHeatPlayer: null,
    heatGainByAction: {}
  },
  boost: {
    implemented: false,
    uses: 0,
    note: "No standalone boost command/mechanic was found in the authoritative command router. Drug/effect-like building outputs are measured under building specials."
  },
  stability: {
    runtimeErrors: 0,
    invariantViolations: 0,
    invalidStates: 0,
    snapshotCommandLogDivergence: 0,
    completed: false
  },
  fairness: {
    giniWealth: 0,
    topToMedianWealthRatio: 0,
    topFactionWealth: null,
    bottomFactionWealth: null,
    behaviorSuccessRates: {},
    dominantBehaviorWarning: null,
    dominantFactionWarning: null
  }
});

const createEmptyDiagnostics = (): ClosedAlphaDiagnostics => ({
  actionReadiness: {
    submittedCommands: 0,
    skippedNotReadyActions: 0,
    rejectedCommands: 0,
    plannerAvoidableRejects: 0,
    trueServerRejects: 0,
    skipReasons: {},
    skipReasonsByBehavior: {},
    plannerAvoidableRejectReasons: {},
    trueServerRejectReasons: {}
  },
  rejectedCommands: {
    totalRejected: 0,
    rejectedRate: 0,
    byCommandType: {},
    byBehavior: {},
    byFaction: {},
    byReason: {},
    byCategory: emptyRejectionCategoryCounts(),
    topReasons: []
  },
  alliance: {
    commandsAvailable: {
      createAlliance: true,
      joinAlliance: true,
      inviteAllianceMember: true,
      respondAllianceInvite: true
    },
    requiresInfluence: true,
    requiredInfluence: ALLIANCE_CREATE_REQUIRED_INFLUENCE,
    allianceCreateIntentions: 0,
    allianceCreateSkippedNotEnoughInfluence: 0,
    allianceCreateSubmitted: 0,
    allianceCreateAccepted: 0,
    allianceCreateRejected: 0,
    allianceReadyButNotSubmitted: 0,
    firstAllianceReadyStep: null,
    firstAllianceCreatedStep: null,
    diplomatAllianceAttempts: 0,
    rejectedAllianceCommands: 0,
    rejectionReasons: {},
    maxInfluenceByPlayer: {},
    playersEverEligible: [],
    readinessTimeline: [],
    conclusion: "Simulation failed before alliance diagnostics could run.",
    recommendations: []
  },
  conflict: {
    attackPrimaryIntentions: 0,
    attackPlanFailures: 0,
    attackReadinessSkipped: 0,
    attackPlanFailureReasons: {},
    submittedAttacks: 0,
    acceptedAttacks: 0,
    rejectedAttacks: 0,
    successfulAttacks: 0,
    rejectedAttackReasons: {},
    spyAuthorizationsCreated: 0,
    spyAuthorizationUsedByAttack: 0,
    relevantSuccessfulSpies: 0,
    followUpAttacksAfterSpy: 0,
    spyToAttackConversionRate: 0,
    averageStepsBetweenSpyAndAttack: null,
    plannedAttackFailureReasons: {},
    conclusion: "Simulation failed before conflict diagnostics could run."
  },
  bounty: {
    records: [],
    created: 0,
    claimed: 0,
    claimRate: 0,
    unclaimedReasons: {},
    attacksOnPlayersWithBounty: 0,
    attacksOnPlayersWithoutBounty: 0,
    bountyConflictLift: null,
    targetsWithValidAttackPath: 0,
    targetsWithoutValidAttackPath: 0,
    claimAttemptIntentions: 0,
    claimSkippedNoValidAttack: 0,
    claimSubmitted: 0,
    claimAccepted: 0,
    claimRejected: 0,
    selfClaimAbuseDetected: false,
    conclusion: "Simulation failed before bounty diagnostics could run."
  },
  bountyOpportunityFunnel: {
    bountyCreated: 0,
    bountyTargetsWithValidAttackPath: 0,
    bountyTargetsWithoutValidAttackPath: 0,
    bountyClaimAttemptIntentions: 0,
    bountyClaimSkippedNoValidAttack: 0,
    bountyClaimSubmitted: 0,
    bountyClaimAccepted: 0,
    bountyClaimRejected: 0,
    bountyClaimed: 0,
    bountyConflictLift: null,
    bountyUnclaimedReasons: {}
  },
  buildingSpecialCoverage: {
    totalConfigured: 0,
    reachableSpecialActions: 0,
    submittedSpecialActions: 0,
    acceptedSpecialActions: 0,
    rejectedSpecialActions: 0,
    trulyUnreachableSpecialActions: 0,
    behaviorIgnoredSpecialActions: 0,
    usedActions: 0,
    unusedActions: 0,
    categories: {},
    actions: []
  },
  spyFollowUpQueue: {
    spySuccesses: 0,
    opportunitiesCreated: 0,
    opportunitiesExpired: 0,
    attacksSubmitted: 0,
    attacksAccepted: 0,
    attacksSuccessful: 0,
    blockedReasons: {},
    openOpportunities: 0
  },
  snowball: {
    wealthTimeline: [],
    topSnowballMoments: [],
    topPlayerBreakdown: {
      playerId: null,
      behavior: null,
      factionId: null,
      finalWealth: 0,
      heat: 0,
      positiveWealthDeltaByCommandType: {},
      positiveWealthDeltaBySource: {},
      cleanCashGainByCommandType: {},
      dirtyCashGainByCommandType: {},
      influenceGainByCommandType: {}
    },
    wealthByBehavior: {},
    wealthGainByPlayerSource: {},
    wealthGainByBehaviorSource: {},
    topIncomeSourcesOverall: [],
    topPlayersByNetWealthGain: [],
    topBehaviorByNetWealthGain: null,
    topFactionByNetWealthGain: null,
    conclusion: "Simulation failed before snowball diagnostics could run."
  },
  policeRaids: {
    dayLimit: 2,
    nightLimit: 1,
    triggered: 0,
    resolved: 0,
    expired: 0,
    pendingFinal: 0,
    bySeverity: {},
    byPlayer: {},
    maxOpenPendingRaids: 0,
    conclusion: "Simulation failed before police raid diagnostics could run."
  },
  boost: buildBoostDiagnostics()
});

const resolveAvailableBuildingActions = (state: CoreGameState): Array<{ buildingTypeId: string; actionId: string }> => {
  const actions = resolveModeConfig("free").balance.buildingActions ?? {};
  return Object.values(actions).map((action) => ({
    buildingTypeId: action.buildingType,
    actionId: action.actionId
  }));
};

const getOwnedDistrictPanels = (
  state: MutableSimulationState,
  player: SimulationPlayer
): Array<{ slice: GameplaySliceView; panel: DistrictPanelView }> => {
  const runtime = getRuntime(state.server);
  return Object.values(runtime.state.districtsById)
    .filter((district) => district.ownerPlayerId === player.id && district.status !== "destroyed")
    .map((district) => state.server.instanceManager.getGameplaySliceProjection(INSTANCE_ID, player.id, district.id) as GameplaySliceView | undefined)
    .filter((slice): slice is GameplaySliceView => Boolean(slice?.district))
    .map((slice) => ({ slice, panel: slice.district! }));
};

const findAttackTargetView = (
  state: MutableSimulationState,
  playerId: string,
  sourceDistrictId: string | undefined,
  targetDistrictId: string
): DistrictPanelView["attackTargets"][number] | null => {
  if (!sourceDistrictId) return null;
  const slice = state.server.instanceManager.getGameplaySliceProjection(INSTANCE_ID, playerId, sourceDistrictId) as GameplaySliceView | undefined;
  return slice?.district?.attackTargets.find((target) => target.districtId === targetDistrictId) ?? null;
};

const findSpyTargetView = (
  state: MutableSimulationState,
  playerId: string,
  sourceDistrictId: string | undefined,
  targetDistrictId: string
): DistrictPanelView["spyTargets"][number] | null => {
  if (!sourceDistrictId) return null;
  const slice = state.server.instanceManager.getGameplaySliceProjection(INSTANCE_ID, playerId, sourceDistrictId) as GameplaySliceView | undefined;
  return slice?.district?.spyTargets.find((target) => target.districtId === targetDistrictId) ?? null;
};

const findBuildingActionView = (
  state: MutableSimulationState,
  playerId: string,
  districtId: string,
  buildingId: string,
  actionId: string
): BuildingActionView | null => {
  const slice = state.server.instanceManager.getGameplaySliceProjection(INSTANCE_ID, playerId, districtId) as GameplaySliceView | undefined;
  return slice?.district?.buildings
    .find((building) => building.buildingId === buildingId)
    ?.actions.find((action) => action.actionId === actionId) ?? null;
};

const hasValidAttackPath = (
  state: MutableSimulationState,
  attackerPlayerId: string,
  targetPlayerId: string
): boolean => {
  const attacker = state.players.find((player) => player.id === attackerPlayerId);
  if (!attacker) return false;
  return getOwnedDistrictPanels(state, attacker).some(({ panel }) =>
    panel.attackTargets.some((target) => target.ownerPlayerId === targetPlayerId && target.enabled)
    || panel.spyTargets.some((target) => target.ownerPlayerId === targetPlayerId && target.enabled)
  );
};

const hasActiveBountyOnTarget = (state: MutableSimulationState, targetPlayerId: string): boolean =>
  Object.values(getRuntime(state.server).state.bountiesById ?? {}).some((bounty) =>
    bounty.targetPlayerId === targetPlayerId && bounty.status === "active"
  );

const firstMissingResource = (
  balances: Record<string, number>,
  costs: Record<string, number>
): { resourceId: string; requiredAmount: number; currentAmount: number } | null => {
  for (const [resourceId, rawRequired] of Object.entries(costs)) {
    const requiredAmount = Math.max(0, Number(rawRequired || 0));
    if (requiredAmount <= 0) continue;
    const currentAmount = Number(balances[resourceId] ?? 0);
    if (currentAmount < requiredAmount) {
      return { resourceId, requiredAmount, currentAmount };
    }
  }
  return null;
};

const attackReadinessReason = (disabledReason: string | null): string => {
  const normalized = (disabledReason ?? "").toLowerCase();
  if (normalized.includes("spy")) return "attack.spy_required";
  if (normalized.includes("cool")) return "attack.cooldown";
  if (normalized.includes("own") || normalized.includes("already own")) return "attack.self_target";
  if (normalized.includes("ally")) return "attack.alliance_restricted";
  if (normalized.includes("border") || normalized.includes("neighbor")) return "attack.not_frontier";
  return "attack.not_ready";
};

const spyReadinessReason = (disabledReason: string | null): string => {
  const normalized = (disabledReason ?? "").toLowerCase();
  if (normalized.includes("cool")) return "spy.cooldown";
  if (normalized.includes("own") || normalized.includes("already own")) return "spy.self_target";
  if (normalized.includes("ally")) return "spy.alliance_restricted";
  if (normalized.includes("border") || normalized.includes("neighbor")) return "spy.not_frontier";
  return "spy.not_ready";
};

const isPlannerAvoidableTargetReason = (disabledReason: string | null): boolean => {
  const normalized = (disabledReason ?? "").toLowerCase();
  return normalized.includes("own")
    || normalized.includes("ally")
    || normalized.includes("border")
    || normalized.includes("neighbor")
    || normalized.includes("spy")
    || normalized.includes("cool");
};

const isPlannerAvoidableRejectCode = (code: string): boolean =>
  [
    "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE",
    "bounty_insufficient_clean_cash",
    "market_not_enough_cash",
    "attack_cooldown_active",
    "spy_cooldown_active",
    "TARGET_IS_SELF",
    "SPY_TARGET_IS_SELF",
    "TARGET_NOT_ENEMY",
    "TARGET_NOT_ADJACENT",
    "SPY_TARGET_NOT_ADJACENT",
    "NO_VALID_ORIGIN",
    "SPY_REQUIRED",
    "no_attack_weapons"
  ].includes(code);

const estimateStepsToInfluenceReady = (
  state: MutableSimulationState,
  playerId: string,
  currentInfluence: number
): number | null => {
  if (currentInfluence >= ALLIANCE_CREATE_REQUIRED_INFLUENCE) return 0;
  const gains = state.commandAttempts
    .filter((attempt) => attempt.playerId === playerId && attempt.resourceDelta.influence > 0)
    .map((attempt) => attempt.resourceDelta.influence);
  const averageGain = average(gains);
  return averageGain > 0
    ? Math.ceil((ALLIANCE_CREATE_REQUIRED_INFLUENCE - currentInfluence) / averageGain)
    : null;
};

const normalizeScenario = (value: SimulationScenario | string | undefined): SimulationScenario => {
  if (value === "conflict-fixture" || value === "special-coverage") return value;
  return "mixed";
};

const resolveBuildingActionInput = (
  action: BuildingActionView,
  panel: DistrictPanelView,
  slice: GameplaySliceView,
  state: MutableSimulationState,
  player: SimulationPlayer
): Partial<RunBuildingActionCommand["payload"]> | null => {
  const input: Partial<RunBuildingActionCommand["payload"]> = {};
  const balances = summarizePlayerResources(getRuntime(state.server).state, player.id).rawBalances;

  for (const required of action.requiresInput ?? []) {
    const id = required.id;
    if (id === "targetCategory" || id === "category") {
      input.targetCategory = required.options?.[0]?.value ?? "materials";
    } else if (id === "investmentCleanCash" || id === "investment") {
      input.investmentCleanCash = Math.max(100, Math.min(1000, Math.floor(Number(balances.cash || 0) / 2)));
    } else if (id === "dealerSlotId" || id === "slotId") {
      input.dealerSlotId = "slot-1";
      input.slotId = "slot-1";
    } else if (id === "itemId") {
      const drug = DRUG_RESOURCE_IDS.find((resourceId) => Math.floor(Number(balances[resourceId] || 0)) > 0);
      if (!drug) return null;
      input.itemId = drug;
    } else if (id === "amount") {
      const itemId = input.itemId ?? "neon-dust";
      input.amount = Math.max(1, Math.min(required.max ?? 4, Math.floor(Number(balances[itemId] || 0)) || 1));
    } else if (id === "targetDistrictId") {
      input.targetDistrictId = panel.districtId;
    } else if (id === "targetZone") {
      input.targetZone = panel.zone || "industrial";
    } else if (required.options?.[0]) {
      input[id as "category"] = required.options[0].value;
    } else {
      return null;
    }
  }

  if (slice.player.economy.cleanCash < sumRecord(action.effectiveInputCost ?? action.inputCost)) {
    return null;
  }
  return input;
};

const chooseTargetCandidate = <TCandidate>(
  state: MutableSimulationState,
  player: SimulationPlayer,
  candidates: TCandidate[],
  ownerSelector: (candidate: TCandidate) => string | null
): TCandidate | null => {
  if (candidates.length === 0) return null;
  const shuffled = state.rng.shuffle(candidates);
  if (player.targetPreference === "random") return shuffled[0] ?? null;
  const scored = shuffled.map((candidate) => {
    const ownerId = ownerSelector(candidate);
    const resources = ownerId ? summarizePlayerResources(getRuntime(state.server).state, ownerId) : null;
    const ownerWealth = resources ? wealth(resources) : 0;
    const ownerHeat = resources?.heat ?? 0;
    const score = player.targetPreference === "wealthy" || player.targetPreference === "valuable"
      ? ownerWealth
      : player.targetPreference === "weak"
        ? -ownerWealth
        : ownerHeat;
    return { candidate, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.candidate ?? null;
};

const chooseTargetPlayer = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  candidates: SimulationPlayer[]
): SimulationPlayer | null => {
  if (candidates.length === 0) return null;
  return chooseTargetCandidate(state, player, candidates, (candidate) => candidate.id);
};

const createBaseCommand = <TCommand extends GameCommand>(
  player: SimulationPlayer,
  type: TCommand["type"],
  id: string,
  payload: TCommand["payload"],
  clock: MutableClock
): TCommand => ({
  id,
  type,
  mode: "free",
  playerId: player.id,
  serverInstanceId: INSTANCE_ID,
  issuedAt: clock.nowIso(),
  payload,
  clientRequestId: null
}) as TCommand;

const commandId = (player: SimulationPlayer, action: string, step: number): string =>
  `command:${player.id}:${action}:${step}`;

const firstOwnedDistrictId = (state: CoreGameState, playerId: string): string | null =>
  Object.values(state.districtsById).find((district) =>
    district.ownerPlayerId === playerId && district.status !== "destroyed"
  )?.id ?? null;

const summarizePlayerResources = (state: CoreGameState, playerId: string): ResourceSummary => {
  const player = state.playersById[playerId];
  const balances = sanitizeBalances(player ? state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {});
  const materialBalances = Object.fromEntries(MATERIAL_RESOURCE_IDS.map((resourceId) => [resourceId, Number(balances[resourceId] ?? 0)]));
  const ownedDistricts = Object.values(state.districtsById).filter((district) => district.ownerPlayerId === playerId);
  const policeHeat = player ? Number(state.policeStatesById[player.policeStateId]?.heat ?? 0) : 0;
  return {
    cleanCash: Number(balances.cash ?? 0),
    dirtyCash: Number(balances["dirty-cash"] ?? 0),
    influence: round(ownedDistricts.reduce((total, district) => total + Number(district.influence || 0), 0), 4),
    heat: round(policeHeat + ownedDistricts.reduce((total, district) => total + Number(district.heat || 0), 0), 4),
    materials: round(sumRecord(materialBalances), 4),
    population: Math.max(0, Number(player?.population ?? balances.population ?? 0)),
    rawBalances: balances,
    materialBalances
  };
};

const getRuntime = (server: ServerApp) => {
  const runtime = server.instanceManager.getInstanceById(INSTANCE_ID);
  if (!runtime) {
    throw new Error(`Simulation runtime ${INSTANCE_ID} was not found.`);
  }
  return runtime;
};

const withDeterministicGlobals = async <TResult>(
  rng: SeededRng,
  clock: MutableClock,
  callback: () => Promise<TResult>
): Promise<TResult> => {
  const originalRandom = Math.random;
  const originalDateNow = Date.now;
  Math.random = () => rng.next();
  Date.now = () => clock.now().getTime();
  try {
    return await callback();
  } finally {
    Math.random = originalRandom;
    Date.now = originalDateNow;
  }
};

const buildEarlyFailureReport = (input: {
  seed: string;
  steps: number;
  playerCount: number;
  tickRateMs: number;
  requiredFactionCount: number;
  availableFactionCount: number;
  errors: string[];
  wallClockMs: number;
}): ClosedAlphaSimulationReport => ({
  name: "20-player mixed-behavior closed-alpha simulation",
  passed: false,
  config: {
    seed: input.seed,
    steps: input.steps,
    playerCount: input.playerCount,
    scenario: "mixed",
    tickRateMs: input.tickRateMs,
    resourceFieldMapping: {
      cleanCash: "resource.balances.cash",
      dirtyCash: "resource.balances['dirty-cash']",
      influence: "sum(district.influence for owned districts)",
      heat: "policeState.heat + sum(district.heat for owned districts)",
      materials: `sum(${MATERIAL_RESOURCE_IDS.join(", ")})`
    },
    maxFactionOccurrences: MAX_FACTION_OCCURRENCES
  },
  runtime: { completed: false, finalTick: 0, wallClockMs: Math.round(input.wallClockMs) },
  players: [],
  factions: {
    availableFactionCount: input.availableFactionCount,
    requiredFactionCount: input.requiredFactionCount,
    distribution: {},
    maxOccurrence: 0
  },
  initialResources: {},
  finalResources: {},
  liveness: {
    stateCounts: {},
    invalidSoftlocks: 0,
    playersWithNoValidOrigin: 0,
    playersWithNoFutureDeadline: 0,
    defeatedPlayers: 0,
    lastStandActivations: 0,
    emergencyRecoveryClaims: 0
  },
  metrics: createEmptyMetrics([]),
  diagnostics: createEmptyDiagnostics(),
  warnings: [],
  errors: input.errors,
  invariantViolations: input.errors,
  rawEventCounters: {},
  commandAttemptsSample: [],
  recommendations: ["Add enough factions or explicitly adjust the simulation constraints before running a 20-player closed-alpha audit."]
});

const buildWarnings = (state: MutableSimulationState): string[] => {
  const warnings: string[] = [];
  if (state.metrics.boost.implemented === false) warnings.push(state.metrics.boost.note);
  if (state.metrics.commands.rejected / Math.max(1, state.metrics.commands.totalSubmitted) > 0.45) {
    warnings.push("More than 45% of submitted commands were rejected; inspect cooldowns, resource gates, and action availability.");
  }
  if (state.readinessSkips.length > state.commandAttempts.length * 0.35) {
    warnings.push(`${state.readinessSkips.length} actions were skipped by simulation readiness checks; planner/UI prerequisites may still be too noisy.`);
  }
  for (const [behavior, count] of Object.entries(state.unavailableActionsByBehavior)) {
    if (count > state.steps * 0.1) warnings.push(`${behavior} often had no available command (${count} times).`);
  }
  if (state.metrics.buildings.unusedSpecialActions.length > 0) {
    warnings.push(`${state.metrics.buildings.unusedSpecialActions.length} configured building special actions were not used in this run.`);
  }
  if (state.metrics.combat.attacks === 0) warnings.push("No attacks happened during the simulation.");
  if (state.metrics.spying.actions === 0) warnings.push("No spy actions happened during the simulation.");
  if (state.metrics.bounty.created === 0) warnings.push("No bounties were created; bounty economy may be too gated by clean cash.");
  if (state.metrics.alliances.activeAlliances.length === 0) warnings.push("No active alliances existed at the end of the simulation.");
  if (state.metrics.fairness.dominantBehaviorWarning) warnings.push(state.metrics.fairness.dominantBehaviorWarning);
  if (state.metrics.fairness.dominantFactionWarning) warnings.push(state.metrics.fairness.dominantFactionWarning);
  return warnings;
};

const buildRecommendations = (state: MutableSimulationState): string[] => {
  const recommendations: string[] = [];
  if (state.metrics.commands.rejected / Math.max(1, state.metrics.commands.totalSubmitted) > 0.45) {
    recommendations.push("Tune bot-facing command availability or cooldown/read-model hints before a human closed-alpha; high rejection rates create noisy UX.");
  }
  if (state.readinessSkips.length > state.commandAttempts.length * 0.25) {
    recommendations.push("High readiness-skip volume means the UI/planner should expose resource, cooldown, and target prerequisites earlier instead of letting players discover them by failed clicks.");
  }
  if (state.metrics.bounty.created === 0 || state.metrics.bounty.claimed === 0) {
    recommendations.push("Run a focused bounty flow audit with funded bounty hunters and guaranteed target adjacency; mixed simulation did not prove healthy bounty completion.");
  }
  if (state.metrics.alliances.activeAlliances.length === 0) {
    recommendations.push("Alliance creation depends on district influence; verify early-game influence pacing if alliances should matter in the first session.");
  }
  if (state.metrics.combat.attacks < state.players.length) {
    recommendations.push("Conflict density is low for 20 players; review spy authorization and cooldown pacing if closed alpha should produce visible fights quickly.");
  }
  if (state.scenario === "conflict-fixture" && state.metrics.combat.attacks < Math.ceil(state.players.length / 2)) {
    recommendations.push("Conflict fixture still produced few attacks despite seeded frontier targets; inspect spy authorization TTL/cooldowns before tuning combat rewards.");
  }
  if (state.scenario === "special-coverage" && state.metrics.buildings.unusedSpecialActions.length > 0) {
    recommendations.push("Special coverage left some configured actions unused; classify remaining blockers as resources, cooldowns, or input prerequisites before balancing behavior weights.");
  }
  if (state.metrics.buildings.cooldownViolations > 0) {
    recommendations.push("Fix building action cooldown enforcement before closed alpha.");
  }
  if (state.invariantViolations.length === 0) {
    recommendations.push("Run `SIM_STEPS=1000 npm run simulate:20p` before the human test and compare reports across several seeds.");
  }
  return recommendations;
};

const buildAggregateRecommendations = (reports: ClosedAlphaSimulationReport[]): string[] => {
  const rejectedRate = average(reports.map((report) => report.diagnostics.rejectedCommands.rejectedRate));
  const skippedReadiness = average(reports.map((report) => report.diagnostics.actionReadiness.skippedNotReadyActions));
  const activeAlliances = average(reports.map((report) => report.metrics.alliances.activeAlliances.length));
  const spyConversion = average(reports.map((report) => report.diagnostics.conflict.spyToAttackConversionRate));
  const bountyClaimRate = average(reports.map((report) => report.diagnostics.bounty.claimRate));
  const recommendations: string[] = [];
  if (activeAlliances < 1) recommendations.push("Alliance pacing remains the top social-system risk: players usually attempt alliance creation before enough influence is available.");
  if (spyConversion < 0.15) recommendations.push("Spy succeeds often but rarely becomes combat; add readiness-aware follow-up targeting before increasing attack rewards.");
  if (rejectedRate > 0.3) recommendations.push("Rejected command rate is high enough to audit read-model availability, affordability gates, and bot/player action hints.");
  if (skippedReadiness > 100) recommendations.push("Readiness skipped many actions across seeds; surface those blockers in UI/planner hints before changing gameplay numbers.");
  if (bountyClaimRate < 0.35) recommendations.push("Bounty creates some conflict but claim rules require targeted captures; add a focused bounty scenario before tuning rewards.");
  recommendations.push("Run at least 10 seeds x 1000 steps after diagnostics stabilize, then compare against these aggregate baselines.");
  return recommendations;
};

const formatAggregateMetricBullets = (aggregate: ClosedAlphaAggregateReport): string =>
  Object.entries(aggregate.metrics)
    .map(([key, stat]) => `- ${key}: avg=${round(stat.average, 3)}, median=${round(stat.median, 3)}, min=${round(stat.min, 3)}, max=${round(stat.max, 3)}, std=${round(stat.standardDeviation, 3)}`)
    .join("\n");

const mergeCountRecords = (records: Array<Record<string, number>>): Record<string, number> =>
  records.reduce<Record<string, number>>((merged, record) => {
    for (const [key, value] of Object.entries(record)) increment(merged, key, value);
    return merged;
  }, {});

const uniqueSorted = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

const statSummary = (values: number[]): StatSummary => {
  if (values.length === 0) return emptyStatSummary();
  const avg = average(values);
  return {
    average: round(avg, 6),
    median: round(median(values), 6),
    min: round(Math.min(...values), 6),
    max: round(Math.max(...values), 6),
    standardDeviation: round(Math.sqrt(average(values.map((value) => (value - avg) ** 2))), 6)
  };
};

const emptyStatSummary = (): StatSummary => ({
  average: 0,
  median: 0,
  min: 0,
  max: 0,
  standardDeviation: 0
});

const recordActionPlanFailure = (
  state: MutableSimulationState,
  player: SimulationPlayer,
  actionKind: ActionKind,
  step: number
): void => {
  const runtimeState = getRuntime(state.server).state;
  const resources = summarizePlayerResources(runtimeState, player.id);
  const ownedPanels = getOwnedDistrictPanels(state, player);
  const disabledReasonCounts = ownedPanels.reduce<Record<string, number>>((counts, { panel }) => {
    const targets = actionKind === "attack"
      ? panel.attackTargets
      : actionKind === "spy"
        ? panel.spyTargets
        : actionKind === "rob"
          ? panel.robTargets ?? []
          : actionKind === "heist"
            ? panel.heistTargets ?? []
            : actionKind === "occupy"
              ? panel.occupyTargets
              : [];
    for (const target of targets) {
      const disabledCode = "disabledCode" in target ? target.disabledCode : null;
      if (!target.enabled) increment(counts, String(target.disabledReason ?? disabledCode ?? "disabled"));
    }
    return counts;
  }, {});
  const enabledTargets = ownedPanels.reduce((total, { panel }) => {
    const targets = actionKind === "attack"
      ? panel.attackTargets
      : actionKind === "spy"
        ? panel.spyTargets
        : actionKind === "rob"
          ? panel.robTargets ?? []
          : actionKind === "heist"
            ? panel.heistTargets ?? []
            : actionKind === "occupy"
              ? panel.occupyTargets
              : [];
    return total + targets.filter((target) => target.enabled).length;
  }, 0);
  state.actionPlanFailures.push({
    step,
    playerId: player.id,
    behavior: player.behavior,
    factionId: player.factionId,
    actionKind,
    ownedDistricts: ownedPanels.length,
    enabledTargets,
    disabledReasonCounts,
    influence: resources.influence,
    cleanCash: resources.cleanCash,
    dirtyCash: resources.dirtyCash
  });
};

const recordOwnedBuildingTypes = (state: MutableSimulationState): void => {
  for (const building of Object.values(getRuntime(state.server).state.buildingsById)) {
    if (!building.ownerPlayerId || building.status !== "active") continue;
    increment(state.ownedBuildingTypeCountsEver, building.buildingTypeId);
  }
};

const recordWealthTimeline = (state: MutableSimulationState, step: number): void => {
  const runtimeState = getRuntime(state.server).state;
  const byPlayer = state.players.reduce<Record<string, number>>((record, player) => {
    record[player.id] = round(wealth(summarizePlayerResources(runtimeState, player.id)), 2);
    return record;
  }, {});
  const byBehavior = state.players.reduce<Record<string, number>>((record, player) => {
    increment(record, player.behavior, byPlayer[player.id] ?? 0);
    return record;
  }, {});
  state.wealthTimeline.push({
    step,
    tick: runtimeState.root.tick,
    byPlayer,
    byBehavior
  });
};

const diffResourceSummary = (before: ResourceSummary, after: ResourceSummary): ResourceDelta => ({
  cleanCash: round(after.cleanCash - before.cleanCash, 4),
  dirtyCash: round(after.dirtyCash - before.dirtyCash, 4),
  influence: round(after.influence - before.influence, 4),
  heat: round(after.heat - before.heat, 4),
  materials: round(after.materials - before.materials, 4),
  population: round(after.population - before.population, 4),
  wealth: round(wealth(after) - wealth(before), 4)
});

const getBuildingCommandMetadata = (
  state: CoreGameState,
  command: GameCommand
): { buildingTypeId: string | null; actionId: string | null } => {
  if (command.type !== "run-building-action") return { buildingTypeId: null, actionId: null };
  const payload = command.payload as RunBuildingActionCommand["payload"];
  return {
    buildingTypeId: state.buildingsById[payload.buildingId]?.buildingTypeId ?? null,
    actionId: payload.actionId
  };
};

const resolveTargetType = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string | null,
  targetPlayerId: string | null
): string => {
  if (targetPlayerId === playerId) return "self";
  if (targetPlayerId && areAllied(state, playerId, targetPlayerId)) return "ally-player";
  if (targetPlayerId) return "enemy-player";
  if (!targetDistrictId) return "none";
  const district = state.districtsById[targetDistrictId];
  if (!district) return "missing-district";
  if (district.ownerPlayerId === playerId) return "owned-district";
  if (!district.ownerPlayerId) return "empty-district";
  return "enemy-district";
};

const emptyRejectionCategoryCounts = (): Record<RejectionCategory, number> => ({
  insufficient_resources: 0,
  cooldown: 0,
  invalid_target: 0,
  alliance_restriction: 0,
  missing_prerequisite: 0,
  ownership_issue: 0,
  spy_requirement: 0,
  bounty_invalid_state: 0,
  building_action_unavailable: 0,
  duplicate_or_idempotency: 0,
  unknown: 0
});

const classifyRejectionCode = (code: string): RejectionCategory => {
  const lower = code.toLowerCase();
  if (lower.includes("payload_conflict") || lower.includes("duplicate") || lower.includes("idempot")) return "duplicate_or_idempotency";
  if (lower.includes("alliance")) return "alliance_restriction";
  if (lower.includes("bounty")) return "bounty_invalid_state";
  if (lower.includes("spy_required") || lower.includes("occupy_spy") || lower.includes("spy auth")) return "spy_requirement";
  if (lower.includes("cooldown")) return "cooldown";
  if (lower.includes("insufficient") || lower.includes("not_enough") || lower.includes("no_population") || lower.includes("pool_empty")) return "insufficient_resources";
  if (lower.includes("building_action") || lower.includes("building_upgrade") || lower.includes("production_storage_full") || lower.includes("unavailable")) return "building_action_unavailable";
  if (lower.includes("owner") || lower.includes("forbidden") || lower.includes("not_owned")) return "ownership_issue";
  if (lower.includes("required") || lower.includes("missing") || lower.includes("blocked")) return "missing_prerequisite";
  if (lower.includes("target") || lower.includes("district_not") || lower.includes("player_not")) return "invalid_target";
  return "unknown";
};

const suggestedFixForRejection = (reason: string): string => {
  const category = classifyRejectionCode(reason);
  switch (category) {
    case "insufficient_resources":
      return "Gate the action until read-model affordability is true, or give the behavior a cheaper fallback.";
    case "cooldown":
      return "Respect cooldown remaining ticks in the decision engine/read model.";
    case "alliance_restriction":
      return "Delay alliance creation until influence requirement is met; expose readiness earlier.";
    case "spy_requirement":
      return "Chain successful spy intel into conflict before TTL/version invalidates it.";
    case "bounty_invalid_state":
      return "Do not create bounty without clean cash and valid non-self target.";
    case "building_action_unavailable":
      return "Use action.enabled/status and required input/cost before submitting.";
    case "duplicate_or_idempotency":
      return "Expected probe unless seen in normal player commands.";
    case "invalid_target":
      return "Refresh target lists after ownership/capture changes.";
    case "ownership_issue":
      return "Require current ownership checks before submitting.";
    case "missing_prerequisite":
      return "Surface prerequisites in action availability and bot planning.";
    default:
      return "Inspect command payload and read-model availability.";
  }
};

const classifyUnusedBuildingAction = (input: {
  everOwnedRequiredBuilding: boolean;
  attempts: CommandAttemptAudit[];
  rejectionReasons: Record<string, number>;
}): string => {
  if (!input.everOwnedRequiredBuilding) return "unreachable because building never owned";
  const reasons = Object.keys(input.rejectionReasons).join(" ").toLowerCase();
  if (/insufficient|not_enough|no_population|pool_empty|missing_input/u.test(reasons)) return "unaffordable";
  if (/cooldown|unavailable|blocked|storage_full/u.test(reasons)) return "invalid/cooldown blocked";
  if (input.attempts.length === 0 && Object.keys(input.rejectionReasons).length === 0) return "not selected by behavior engine";
  return "unknown reason";
};

const suggestedUnusedBuildingReason = (category: string | null, rejectionReasons: Record<string, number>): string => {
  if (!category) return "Used during the simulation.";
  if (category === "unreachable because building never owned") return "No player owned this required building type during the run.";
  if (category === "unaffordable") return `Owned but failed affordability gates: ${formatCounts(rejectionReasons)}.`;
  if (category === "invalid/cooldown blocked") return `Owned but blocked by state/cooldown: ${formatCounts(rejectionReasons)}.`;
  if (category === "not selected by behavior engine") return "The action was reachable but the weighted behavior planner never selected it.";
  return `No precise cause; observed rejections: ${formatCounts(rejectionReasons) || "none"}.`;
};

const sourceCategoryForCommand = (attempt: CommandAttemptAudit): string => {
  if (attempt.commandType === "attack-district" || attempt.commandType === "heist-district" || attempt.commandType === "rob-district") {
    return "attack_loot_conflict";
  }
  if (attempt.commandType === "run-building-action") return "special_action";
  if (attempt.commandType === "collect-production") return "production_collection";
  if (attempt.commandType.includes("market")) return "market_trading";
  if (attempt.commandType.includes("bounty")) return "bounty_rewards_or_costs";
  if (attempt.commandType.includes("alliance")) return "alliance_effects";
  return "other";
};

const buildWealthGainByPlayerSource = (state: MutableSimulationState): Record<string, Record<string, number>> => {
  const result = state.players.reduce<Record<string, Record<string, number>>>((record, player) => {
    record[player.id] = { starting_resources: round(wealth(state.initialResources[player.id]!), 2) };
    return record;
  }, {});

  for (const attempt of state.commandAttempts.filter((entry) => entry.accepted)) {
    const source = sourceCategoryForCommand(attempt);
    const positive = Math.max(0, attempt.resourceDelta.wealth);
    const negative = Math.min(0, attempt.resourceDelta.wealth);
    if (positive > 0) increment(result[attempt.playerId]!, source, round(positive, 2));
    if (negative < 0) increment(result[attempt.playerId]!, "costs_paid_or_losses", round(negative, 2));
    if (attempt.resourceDelta.heat > 0) increment(result[attempt.playerId]!, "heat_police_pressure", round(-attempt.resourceDelta.heat * 10, 2));
  }

  return result;
};

const buildTopSnowballMoments = (state: MutableSimulationState): ClosedAlphaDiagnostics["snowball"]["topSnowballMoments"] => {
  const moments: ClosedAlphaDiagnostics["snowball"]["topSnowballMoments"] = [];
  for (let index = 1; index < state.wealthTimeline.length; index += 1) {
    const previous = state.wealthTimeline[index - 1]!;
    const current = state.wealthTimeline[index]!;
    for (const player of state.players) {
      const wealthDelta = (current.byPlayer[player.id] ?? 0) - (previous.byPlayer[player.id] ?? 0);
      if (wealthDelta <= 0) continue;
      moments.push({
        stepFrom: previous.step,
        stepTo: current.step,
        playerId: player.id,
        behavior: player.behavior,
        wealthDelta: round(wealthDelta, 2)
      });
    }
  }
  return moments.sort((left, right) => right.wealthDelta - left.wealthDelta).slice(0, 10);
};

const formatCounts = (counts: Record<string, number>): string =>
  Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${round(value, 2)}`)
    .join(", ");

const matchesStartingResources = (summary: ResourceSummary): boolean =>
  summary.cleanCash === 5000
  && summary.dirtyCash === 1000
  && summary.influence === 0
  && summary.heat === 0
  && summary.materials === 0;

const resourceTuple = (summary: ResourceSummary): string =>
  `${round(summary.cleanCash)}/${round(summary.dirtyCash)}/${round(summary.influence)}/${round(summary.heat)}/${round(summary.materials)}`;

const countBy = <TItem>(
  items: readonly TItem[],
  selector: (item: TItem) => string
): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => {
    increment(counts, selector(item));
    return counts;
  }, {});

const increment = (counts: Record<string, number>, key: string, amount = 1): void => {
  counts[key] = (counts[key] ?? 0) + amount;
};

const maxValue = (record: Record<string, number>): number =>
  Object.values(record).reduce((max, value) => Math.max(max, value), 0);

const maxEntry = (record: Record<string, number>): [string, number] | null =>
  Object.entries(record).sort((left, right) => right[1] - left[1])[0] ?? null;

const minEntry = (record: Record<string, number>): [string, number] | null =>
  Object.entries(record).sort((left, right) => left[1] - right[1])[0] ?? null;

const sanitizeBalances = (balances: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(balances).map(([key, value]) => [key, Number(value || 0)]));

const sumRecord = (record: Record<string, number>): number =>
  Object.values(record).reduce((total, value) => total + Number(value || 0), 0);

const sumResourceSummaries = (summaries: Record<string, ResourceSummary>): ResourceSummary =>
  Object.values(summaries).reduce<ResourceSummary>((total, summary) => ({
    cleanCash: total.cleanCash + summary.cleanCash,
    dirtyCash: total.dirtyCash + summary.dirtyCash,
    influence: total.influence + summary.influence,
    heat: total.heat + summary.heat,
    materials: total.materials + summary.materials,
    population: total.population + summary.population,
    rawBalances: {},
    materialBalances: {}
  }), {
    cleanCash: 0,
    dirtyCash: 0,
    influence: 0,
    heat: 0,
    materials: 0,
    population: 0,
    rawBalances: {},
    materialBalances: {}
  });

const wealth = (summary: ResourceSummary): number =>
  summary.cleanCash + summary.dirtyCash * 0.5 + summary.materials * 250 + summary.influence * 40 + summary.population * 10 - summary.heat * 10;

const sumWealth = (summaries: ResourceSummary[]): number =>
  summaries.reduce((total, summary) => total + wealth(summary), 0);

const average = (values: number[]): number =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle] ?? 0;
};

const gini = (values: number[]): number => {
  const sorted = values.map((value) => Math.max(0, value)).sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (sorted.length === 0 || total === 0) return 0;
  const weighted = sorted.reduce((sum, value, index) => sum + (index + 1) * value, 0);
  return (2 * weighted) / (sorted.length * total) - (sorted.length + 1) / sorted.length;
};

const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

const yesNo = (value: boolean): string => value ? "ano" : "ne";

const areAllied = (state: CoreGameState, leftPlayerId: string, rightPlayerId: string): boolean => {
  const left = state.playersById[leftPlayerId];
  const right = state.playersById[rightPlayerId];
  return Boolean(left?.allianceId && left.allianceId === right?.allianceId);
};

const factionColor = (factionId: PlayerFactionId): string =>
  FACTION_DEFINITIONS.find((definition) => definition.id === factionId)?.uiTheme.accent ?? "#3b82f6";

const detectDominantBehavior = (
  state: MutableSimulationState,
  finalResources: Record<string, ResourceSummary>
): string | null => {
  const byBehavior = state.players.reduce<Record<string, number>>((totals, player) => {
    totals[player.behavior] = (totals[player.behavior] ?? 0) + wealth(finalResources[player.id]!);
    return totals;
  }, {});
  const top = maxEntry(byBehavior);
  const values = Object.values(byBehavior);
  const avg = average(values);
  return top && top[1] > avg * 1.8 ? `${top[0]} behavior is economically dominant in this run.` : null;
};

const detectDominantFaction = (metrics: ClosedAlphaMetrics): string | null => {
  const top = metrics.fairness.topFactionWealth;
  const bottom = metrics.fairness.bottomFactionWealth;
  if (!top || !bottom || bottom.wealth <= 0) return null;
  return top.wealth / bottom.wealth > 2.25
    ? `${top.factionId} final wealth is more than 2.25x ${bottom.factionId}.`
    : null;
};
const sumPlayersByFaction = (report: ClosedAlphaSimulationReport, factionId: string): number =>
  report.players
    .filter((player) => player.factionId === factionId)
    .reduce((total, player) => total + wealth(report.finalResources[player.id]!), 0);
const dedupe = (items: string[]): string[] => [...new Set(items.filter(Boolean))];
const readWallClockMs = (): number =>
  Number(globalThis.performance?.now?.() ?? Date.now());
const stableJson = (value: unknown): string => JSON.stringify(sortForJson(value));
const stableJsonValue = (value: unknown): string => {
  const sorted = sortForJson(value);
  return JSON.stringify(sorted, null, 2);
};
const sortForJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortForJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortForJson(child)])
  );
};
