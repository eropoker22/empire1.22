import type {
  DistrictId,
  PlayerId,
  ServerInstanceId
} from "@empire/shared-types";

export interface FreeModeSharedCitySimulationOptions {
  playerCount?: number;
  rounds?: number;
  ticksPerRound?: number;
  instanceId?: ServerInstanceId;
  includeInvalidProbe?: boolean;
}

export interface FreeModeSharedCitySimulationCounters {
  actionsAttempted: number;
  actionsAccepted: number;
  actionsRejected: number;
  actionsByType: Record<string, number>;
  acceptedActionsByType: Record<string, number>;
  errorsByCode: Record<string, number>;
  turnsWithoutValidAction: number;
}

export interface FreeModeSharedCitySimulationPlayerScore {
  playerId: PlayerId;
  controlledDistricts: number;
  influence: number;
  cash: number;
  dirtyCash: number;
  score: number;
}

export interface FreeModeSharedCitySimulationReport extends FreeModeSharedCitySimulationCounters {
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

export type SimulationActionType = "spy-district" | "attack-district" | "collect-production";
