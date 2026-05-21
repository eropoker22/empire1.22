import type {
  FreeModeSharedCitySimulationFinalReport,
  FreeModeSharedCitySimulationRoundMetrics
} from "./types";

export interface RoundReadinessMetrics {
  tickRateMs: number;
  attackReadyPlayers: number;
  craftReadyPlayers: number;
  productionReadyPlayers: number;
}

export const createRoundMetrics = (
  round: number,
  current: FreeModeSharedCitySimulationFinalReport,
  previous: FreeModeSharedCitySimulationFinalReport,
  readiness: RoundReadinessMetrics
): FreeModeSharedCitySimulationRoundMetrics => ({
  round,
  tickAfterRound: current.tickCount,
  minuteAfterRound: roundMinute(current.tickCount, readiness.tickRateMs),
  actionsAttempted: current.actionsAttempted - previous.actionsAttempted,
  actionsAccepted: current.actionsAccepted - previous.actionsAccepted,
  actionsRejected: current.actionsRejected - previous.actionsRejected,
  actionsByType: diffRecord(current.actionsByType, previous.actionsByType),
  acceptedActionsByType: diffRecord(current.acceptedActionsByType, previous.acceptedActionsByType),
  actionsByProfile: diffRecord(current.actionsByProfile, previous.actionsByProfile),
  acceptedActionsByProfile: diffRecord(current.acceptedActionsByProfile, previous.acceptedActionsByProfile),
  actionsByTypeAndProfile: diffNestedRecord(current.actionsByTypeAndProfile, previous.actionsByTypeAndProfile),
  errorsByCode: diffRecord(current.errorsByCode, previous.errorsByCode),
  spyReportsTotal: current.spyReportsCreated,
  battleReportsTotal: current.battleReportsCreated,
  cityFeedEventsTotal: current.cityFeedEventsCreated,
  spyReportsDelta: current.spyReportsCreated - previous.spyReportsCreated,
  battleReportsDelta: current.battleReportsCreated - previous.battleReportsCreated,
  cityFeedEventsDelta: current.cityFeedEventsCreated - previous.cityFeedEventsCreated,
  activePlayers: current.activePlayers,
  eliminatedPlayers: current.eliminatedPlayers,
  averageHeat: current.averageHeat,
  maxHeat: current.maxHeat,
  ownedDistricts: current.ownedDistricts,
  neutralDistricts: current.neutralDistricts,
  totalResourcesByKey: { ...current.totalResourcesByKey },
  resourceDeltaByKey: diffRecord(current.totalResourcesByKey, previous.totalResourcesByKey),
  attackReadyPlayers: readiness.attackReadyPlayers,
  craftReadyPlayers: readiness.craftReadyPlayers,
  productionReadyPlayers: readiness.productionReadyPlayers,
  turnsWithoutValidAction: current.turnsWithoutValidAction - previous.turnsWithoutValidAction,
  turnsWithoutValidActionByProfile: diffRecord(current.turnsWithoutValidActionByProfile, previous.turnsWithoutValidActionByProfile),
  profileAssignmentSummary: { ...current.profileAssignmentSummary }
});

export const createZeroFinalReport = (): FreeModeSharedCitySimulationFinalReport => ({
  actionsAttempted: 0,
  actionsAccepted: 0,
  actionsRejected: 0,
  actionsByType: {},
  acceptedActionsByType: {},
  actionsByProfile: {},
  acceptedActionsByProfile: {},
  actionsByTypeAndProfile: {},
  errorsByCode: {},
  turnsWithoutValidAction: 0,
  turnsWithoutValidActionByProfile: {},
  profileAssignmentSummary: {},
  playerCount: 0,
  districtCount: 0,
  tickCount: 0,
  spyReportsCreated: 0,
  battleReportsCreated: 0,
  cityFeedEventsCreated: 0,
  activePlayers: 0,
  eliminatedPlayers: 0,
  crashedInstances: 0,
  averageHeat: 0,
  maxHeat: 0,
  totalResourcesByKey: {},
  topPlayersByScore: [],
  uniqueHomeDistricts: 0,
  connectedMap: true,
  ownedDistricts: 0,
  neutralDistricts: 0
});

const diffRecord = (
  current: Record<string, number>,
  previous: Record<string, number>
): Record<string, number> => {
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  return Object.fromEntries(
    [...keys]
      .map((key) => [key, (current[key] ?? 0) - (previous[key] ?? 0)] as const)
      .filter(([, value]) => value !== 0)
  );
};

const diffNestedRecord = (
  current: Record<string, Record<string, number>>,
  previous: Record<string, Record<string, number>>
): Record<string, Record<string, number>> => {
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  return Object.fromEntries(
    [...keys]
      .map((key) => [key, diffRecord(current[key] ?? {}, previous[key] ?? {})] as const)
      .filter(([, value]) => Object.keys(value).length > 0)
  );
};

const roundMinute = (tick: number, tickRateMs: number): number =>
  Math.round((tick * tickRateMs / 60000) * 100) / 100;
