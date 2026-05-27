import type { ResolvedGameModeConfig } from "@empire/game-config";
import type {
  FreeBrAlliance,
  FreeBrAuditEvent,
  FreeBrDistrict,
  FreeBrPlayer,
  FreeBrScenarioConfig,
  FreeBrStrategyId
} from "./types-core";
import type { FreeBrEliminationAudit, FreeBrTimelineSnapshot } from "./types-report";

export interface FreeBrSimulationState {
  auditLevel: "full" | "matrix";
  config: ResolvedGameModeConfig;
  seed: string;
  scenario: FreeBrScenarioConfig;
  startAtMs: number;
  tick: number;
  players: FreeBrPlayer[];
  districts: FreeBrDistrict[];
  ownedDistrictIdsByPlayer: Record<string, Set<number>>;
  ownedBuildingTypeCountsByPlayer: Record<string, Record<string, number>>;
  alliances: FreeBrAlliance[];
  events: FreeBrAuditEvent[];
  timeline: FreeBrTimelineSnapshot[];
  eliminations: FreeBrEliminationAudit[];
  stats: Record<string, FreeBrMutablePlayerStats>;
  nextEliminationTick: number;
  lastEliminationTick: number | null;
  victoryHoldStartTick: number | null;
  victoryLeaderId: string | null;
  winner: string | null;
  winReason: string;
  hardTimeoutReached: boolean;
  quietHourCache: Map<number, boolean>;
  finalLockdown: {
    status: "inactive" | "active" | "paused" | "resolved";
    startedAtTick: number | null;
    endedAtTick: number | null;
    lastUpdatedTick: number;
    activeElapsedTicks: number;
    remainingActiveTicks: number;
    pausedTicks: number;
    top3: Array<{ playerId: string; score: number; rank: number; scoreBreakdown: Record<string, number> }>;
  };
  hourlyCounters: {
    attacks: number;
    occupations: number;
    spies: number;
    buildingActions: number;
  };
  counters: {
    destroyedDistricts: number;
    downtownCaptures: number;
    rareBuildingActions: number;
    neutralizedDistrictsAfterEliminations: number;
    quietHoursDeferredEliminations: number;
    attacksDuringFinalLockdown: number;
    allianceCoordinatedAttacks: number;
    alliancesAgainstDowntownLeader: number;
    dirtyCashSeized: number;
    resourceSeized: number;
    attacksOnDowntown: number;
    firstDowntownCapture: {
      tick: number;
      districtId: number;
      playerId: string;
      factionId: string;
      strategyId: FreeBrStrategyId;
    } | null;
  };
}

export interface FreeBrMutablePlayerStats {
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
  maxControlledDistricts: number;
  eliminatedAtTick: number | null;
  finalPlacement: number | null;
  controlledDistrictsOverTime: Array<{ hour: number; districts: number }>;
}
