import type {
  DistrictId,
  PlayerId,
  PlayerFactionId,
  ServerInstanceId
} from "@empire/shared-types";

export interface FreeModeSharedCitySimulationOptions {
  playerCount?: number;
  rounds?: number;
  ticksPerRound?: number;
  durationMinutes?: number;
  instanceId?: ServerInstanceId;
  seed?: string;
  scenarioName?: string;
  includeInvalidProbe?: boolean;
  factionRotation?: PlayerFactionId[];
  botProfile?: SimulationBotProfile;
  botProfileRotation?: SimulationBotProfile[];
}

export interface FreeModeSharedCitySimulationCounters {
  actionsAttempted: number;
  actionsAccepted: number;
  actionsRejected: number;
  actionsByType: Record<string, number>;
  acceptedActionsByType: Record<string, number>;
  actionsByProfile: Record<string, number>;
  acceptedActionsByProfile: Record<string, number>;
  actionsByTypeAndProfile: Record<string, Record<string, number>>;
  errorsByCode: Record<string, number>;
  turnsWithoutValidAction: number;
  turnsWithoutValidActionByProfile: Record<string, number>;
  profileAssignmentSummary: Record<string, number>;
}

export interface FreeModeSharedCitySimulationPlayerScore {
  playerId: PlayerId;
  controlledDistricts: number;
  influence: number;
  cash: number;
  dirtyCash: number;
  score: number;
}

export interface FreeModeSharedCitySimulationFinalReport extends FreeModeSharedCitySimulationCounters {
  playerCount: number;
  districtCount: number;
  tickCount: number;
  spyReportsCreated: number;
  battleReportsCreated: number;
  cityFeedEventsCreated: number;
  activePlayers: number;
  eliminatedPlayers: number;
  crashedInstances: number;
  averageHeat: number;
  maxHeat: number;
  totalResourcesByKey: Record<string, number>;
  topPlayersByScore: FreeModeSharedCitySimulationPlayerScore[];
  uniqueHomeDistricts: number;
  connectedMap: boolean;
  ownedDistricts: number;
  neutralDistricts: number;
}

export interface FreeModeSharedCitySimulationRoundMetrics extends FreeModeSharedCitySimulationCounters {
  round: number;
  tickAfterRound: number;
  minuteAfterRound: number;
  spyReportsTotal: number;
  battleReportsTotal: number;
  cityFeedEventsTotal: number;
  spyReportsDelta: number;
  battleReportsDelta: number;
  cityFeedEventsDelta: number;
  activePlayers: number;
  eliminatedPlayers: number;
  averageHeat: number;
  maxHeat: number;
  ownedDistricts: number;
  neutralDistricts: number;
  totalResourcesByKey: Record<string, number>;
  resourceDeltaByKey: Record<string, number>;
  attackReadyPlayers: number;
  craftReadyPlayers: number;
  productionReadyPlayers: number;
}

export interface SimulationKpiHardAssertion {
  name: string;
  passed: boolean;
  actual: number | boolean;
  expected: string;
}

export interface SimulationKpiSoftWarning {
  code: string;
  message: string;
  value: number;
  threshold: number;
}

export interface SimulationKpiEvaluation {
  hardPassed: boolean;
  hardAssertions: SimulationKpiHardAssertion[];
  softWarnings: SimulationKpiSoftWarning[];
  actionAcceptanceRate: number;
  turnsWithoutValidActionRate: number;
  spyToAttackRatio: number;
}

export interface FreeModeSharedCitySimulationReport extends FreeModeSharedCitySimulationFinalReport {
  roundsPlayed: number;
  perRound: FreeModeSharedCitySimulationRoundMetrics[];
  final: FreeModeSharedCitySimulationFinalReport;
  kpi: SimulationKpiEvaluation;
  pacing: FreeModeSharedCityPacingReport;
}

export interface FreeModeSharedCityPacingReport {
  scenarioName: string;
  durationMinutes: number;
  playerCount: number;
  tickRateMs: number;
  resourceBalancesOverTime: FreeModeSharedCityResourceSnapshot[];
  incomePerPhase: FreeModeSharedCityPhaseIncome[];
  milestones: FreeModeSharedCityPacingMilestones;
  heatRaidPressure: FreeModeSharedCityHeatRaidPressure;
  bottleneckResources: FreeModeSharedCityBottleneckResource[];
  warnings: FreeModeSharedCityPacingWarning[];
}

export interface FreeModeSharedCityResourceSnapshot {
  round: number;
  minute: number;
  tick: number;
  totalResourcesByKey: Record<string, number>;
  averageResourcesByPlayer: Record<string, number>;
  ownedDistricts: number;
  neutralDistricts: number;
  acceptedActionsByType: Record<string, number>;
}

export interface FreeModeSharedCityPhaseIncome {
  phase: "early" | "mid" | "late";
  startMinute: number;
  endMinute: number;
  resourceDeltaByKey: Record<string, number>;
  acceptedActionsByType: Record<string, number>;
}

export interface FreeModeSharedCityPacingMilestones {
  firstMeaningfulActionMinute: number | null;
  firstProductionCollectionMinute: number | null;
  firstCraftStartedMinute: number | null;
  firstAttackReadinessMinute: number | null;
  firstAcceptedAttackMinute: number | null;
  firstExpansionMinute: number | null;
}

export interface FreeModeSharedCityHeatRaidPressure {
  averageHeatFinal: number;
  maxHeatFinal: number;
  maxHeatObserved: number;
  roundsAboveHeat20: number;
  roundsAboveHeat40: number;
}

export interface FreeModeSharedCityBottleneckResource {
  resourceKey: string;
  finalAveragePerPlayer: number;
  totalDelta: number;
  reason: string;
}

export interface FreeModeSharedCityPacingWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface FreeModeSharedCitySimulationStateSummary {
  instanceId: ServerInstanceId;
  playerCount: number;
  districtCount: number;
  tick: number;
  connectedMap: boolean;
  uniqueHomeDistricts: number;
  homeDistrictIds: DistrictId[];
}

export interface FreeModeSharedCitySimulationResult {
  report: FreeModeSharedCitySimulationReport;
  finalStateSummary: FreeModeSharedCitySimulationStateSummary;
  errorsByCode: Record<string, number>;
}

export type SimulationActionType = "spy-district" | "occupy-district" | "attack-district" | "collect-production" | "craft-item";
export type SimulationBotProfile = "scout" | "aggressor" | "opportunist" | "economy" | "balanced";

export type FreeModeSharedCityScenarioName =
  | "solo-player-first-30-minutes"
  | "shared-city-5p"
  | "shared-city-20p"
  | "aggressive-conflict-player"
  | "passive-economy-player"
  | "baseline-20p-short"
  | "baseline-20p-longer"
  | "small-8p"
  | "high-tick-pressure"
  | "low-action-pressure"
  | "mixed-factions-20p"
  | "mixed-profiles-20p";

export interface FreeModeSharedCityScenario {
  name: FreeModeSharedCityScenarioName;
  description: string;
  options: FreeModeSharedCitySimulationOptions;
}

export interface FreeModeSharedCityScenarioResult extends FreeModeSharedCitySimulationResult {
  scenario: FreeModeSharedCityScenario;
}

export interface FreeModeSharedCityScenarioMatrixResult {
  scenarios: FreeModeSharedCityScenarioResult[];
}
