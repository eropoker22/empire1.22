import type {
  FreeBrActivityProfile,
  FreeBrAlliance,
  FreeBrAuditEvent,
  FreeBrDistrictZone,
  FreeBrScenarioName,
  FreeBrStrategyId
} from "./types-core";

export interface FreeBrPlayerAudit {
  playerId: string;
  playerName: string;
  factionId: string;
  strategyId: FreeBrStrategyId;
  activityProfile: FreeBrActivityProfile;
  finalPlacement: number;
  survived: boolean;
  eliminatedAtTick: number | null;
  eliminatedAtHour: number | null;
  maxControlledDistricts: number;
  finalControlledDistricts: number;
  downtownDistrictsOwned: number;
  attacksMade: number;
  attacksWon: number;
  attacksLost: number;
  districtsCaptured: number;
  districtsLost: number;
  occupiedNeutralDistricts: number;
  spyActions: number;
  buildingActions: number;
  craftActions: number;
  policeRaidsReceived: number;
  heatGenerated: number;
  cashEarned: number;
  dirtyCashEarned: number;
  allianceCount: number;
  betrayals: number;
  dangerZoneAppearances: number;
  comebackCount: number;
  finalScore: number;
  finalScoreBreakdown?: Record<string, number>;
  controlledDistrictsOverTime: Array<{ hour: number; districts: number }>;
}

export interface FreeBrEliminationAudit {
  tick: number;
  hour: number;
  simulatedTime: string;
  localTime: string;
  eliminatedPlayerId: string;
  playerName: string;
  factionId: string;
  strategyId: FreeBrStrategyId;
  finalPlacement: number;
  eliminationScore: number;
  controlledDistricts: number;
  influence: number;
  cash: number;
  dirtyCash: number;
  resources: number;
  activeBuildings: number;
  population: number;
  reasonWhyWeak: string;
  bottomThree: string[];
  deferredByQuietHours: boolean;
  neutralizedDistricts: number;
  largestBeneficiaryPlayerId: string | null;
}

export interface FreeBrTimelineSnapshot {
  hour: number;
  tick: number;
  activePlayers: number;
  leader: string | null;
  leaderFaction: string | null;
  leaderStrategy: FreeBrStrategyId | null;
  leaderDistricts: number;
  bottomThree: string[];
  attacksThisHour: number;
  occupationsThisHour: number;
  spyActionsThisHour: number;
  buildingActionsThisHour: number;
  alliancesActive: number;
  downtownOwners: Record<string, number>;
  policePressure: number;
  upcomingEliminationCountdownHours: number | null;
  quietHoursActive: boolean;
}

export interface FreeBrSimulationSummary {
  seed: string;
  scenario: FreeBrScenarioName;
  totalSimulatedHours: number;
  totalTicks: number;
  winner: string | null;
  winReason: string;
  finalActivePlayers: number;
  totalEliminations: number;
  totalAttacks: number;
  successfulAttacks: number;
  failedAttacks: number;
  destroyedDistricts: number;
  occupiedNeutralDistricts: number;
  totalSpyActions: number;
  totalBuildingActions: number;
  totalCraftActions: number;
  totalPoliceRaids: number;
  totalHeatGenerated: number;
  totalAlliancesFormed: number;
  totalAlliancesBroken: number;
  totalBetrayals: number;
  totalDowntownCaptures: number;
  totalRareBuildingActions: number;
  totalDangerZoneAppearances: number;
  totalDangerZoneComebacks: number;
  totalNeutralizedDistrictsAfterEliminations: number;
  victoryThresholdDistricts: number;
  leaderDistrictsAtEnd: number;
  hardTimeoutReached: boolean;
  quietHoursDeferredEliminations: number;
  finalLockdownStartedAtHour: number | null;
  finalLockdownEndedAtHour: number | null;
  finalLockdownPausedHours: number;
  finalTop3: Array<{ playerId: string; score: number; rank: number; scoreBreakdown: Record<string, number> }>;
  old75ControlReached: boolean;
  attacksDuringFinalLockdown: number;
}

export interface FreeBrSimulationReport {
  summary: FreeBrSimulationSummary;
  configSnapshot: {
    tickRateMs: number;
    players: number;
    districts: number;
    downtownDistricts: number;
    firstEliminationTick: number;
    eliminationIntervalTicks: number;
    dangerZoneSize: number;
    topStop: number;
    victoryThreshold: number;
    minimumVictoryTicks: number;
    controlHoldTicks: number;
    hardTimeoutTicks: number;
    finalLockdownTriggerActivePlayers: number;
    finalLockdownActiveDurationTicks: number;
  };
  approximations: string[];
  players: FreeBrPlayerAudit[];
  factions: FreeBrFactionAudit[];
  strategies: FreeBrStrategyAudit[];
  districts: FreeBrDistrictAudit;
  timeline: FreeBrTimelineSnapshot[];
  eliminations: FreeBrEliminationAudit[];
  alliances: FreeBrAllianceAudit;
  police: FreeBrPoliceAudit;
  downtown: FreeBrDowntownAudit;
  events: FreeBrAuditEvent[];
}

export interface FreeBrFactionAudit {
  factionId: string;
  playersCount: number;
  averagePlacement: number;
  bestPlacement: number;
  survivalToTop8Count: number;
  totalAttacks: number;
  attackWinRate: number;
  averageDistricts: number;
  averageCash: number;
  averageDirtyCash: number;
  averageHeat: number;
  downtownControlTime: number;
  allianceParticipation: number;
  dangerZoneAppearances: number;
  comebackRate: number;
  verdict: "overpowered" | "healthy" | "weak" | "needs more data";
}

export interface FreeBrStrategyAudit {
  strategyId: FreeBrStrategyId;
  playersCount: number;
  averagePlacement: number;
  top8Rate: number;
  winRate: number;
  attackRate: number;
  expansionRate: number;
  allianceRate: number;
  downtownSuccessRate: number;
  dangerZoneComebackRate: number;
  policeRaidRate: number;
}

export interface FreeBrDistrictAudit {
  mostContestedDistrict: number | null;
  mostValuableDistrict: number | null;
  firstDowntownCaptured: { tick: number; hour: number; districtId: number; playerId: string; factionId: string; strategyId: FreeBrStrategyId } | null;
  downtownOwnerTimeline: Array<{ hour: number; owners: Record<string, number> }>;
  districtOwnershipChurn: number;
  neutralizedDistrictsAfterEliminations: number;
  destroyedDistricts: number;
  heatHotspots: Array<{ districtId: number; heat: number; zone: FreeBrDistrictZone }>;
}

export interface FreeBrAllianceAudit {
  formed: number;
  broken: number;
  betrayals: number;
  averageSize: number;
  largestAlliance: { allianceId: string | null; size: number };
  activeAtEnd: number;
  survivedDueToAlliance: number;
  coordinatedAttacks: number;
  byFaction: Record<string, number>;
  byStrategy: Record<string, number>;
  records: FreeBrAlliance[];
}

export interface FreeBrPoliceAudit {
  totalRaids: number;
  raidsByPlayer: Record<string, number>;
  raidsByFaction: Record<string, number>;
  raidsByStrategy: Record<string, number>;
  highestHeatPlayerId: string | null;
  highestHeat: number;
  totalDirtyCashSeized: number;
  totalResourceSeized: number;
}

export interface FreeBrDowntownAudit {
  verdict: "not a problem" | "mild but healthy" | "risky" | "broken";
  firstCapturedAtHour: number | null;
  firstOwnerPlayerId: string | null;
  earlyOwnerSurvivedTop8: boolean;
  earlyOwnerWon: boolean;
  attacksOnDowntown: number;
  alliancesAgainstDowntownLeader: number;
  rareBuildingActions: number;
  ownerTimeline: Array<{ hour: number; owners: Record<string, number> }>;
  maxDowntownHeldByOnePlayer: number;
}
