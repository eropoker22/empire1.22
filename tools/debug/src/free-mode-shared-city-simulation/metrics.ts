import type { CoreGameState } from "@empire/game-core";
import type { DistrictId, PlayerId, ServerInstanceId } from "@empire/shared-types";
import { isConnectedDistrictGraph } from "./graph";
import type {
  FreeModeSharedCitySimulationCounters,
  FreeModeSharedCitySimulationFinalReport,
  FreeModeSharedCitySimulationReport,
  FreeModeSharedCitySimulationRoundMetrics,
  FreeModeSharedCitySimulationStateSummary
} from "./types";
import { evaluateSimulationKpis } from "./kpi";

export const createInitialSimulationCounters = (): FreeModeSharedCitySimulationCounters => ({
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
  profileAssignmentSummary: {}
});

export const incrementRecord = (record: Record<string, number>, key: string, amount = 1): void => {
  record[key] = (record[key] ?? 0) + amount;
};

export const createSimulationReport = (
  state: CoreGameState,
  counters: FreeModeSharedCitySimulationCounters,
  crashedInstances: number,
  perRound: FreeModeSharedCitySimulationRoundMetrics[] = [],
  expectedPlayerCount = state.root.playerIds.length,
  expectedMinimumTick = 0
): FreeModeSharedCitySimulationReport => {
  const final = createFinalSimulationReport(state, counters, crashedInstances);
  return {
    ...final,
    roundsPlayed: perRound.length,
    perRound,
    final,
    kpi: evaluateSimulationKpis(final, expectedPlayerCount, expectedMinimumTick)
  };
};

export const createFinalSimulationReport = (
  state: CoreGameState,
  counters: FreeModeSharedCitySimulationCounters,
  crashedInstances: number
): FreeModeSharedCitySimulationFinalReport => {
  const playerIds = state.root.playerIds;
  const heats = playerIds.map((playerId) => state.policeStatesById[state.playersById[playerId]?.policeStateId ?? ""]?.heat ?? 0);

  return {
    ...cloneCounters(counters),
    playerCount: playerIds.length,
    districtCount: state.root.districtIds.length,
    tickCount: state.root.tick,
    spyReportsCreated: countNotifications(state, "report.spy"),
    battleReportsCreated: countNotifications(state, "report.battle"),
    cityFeedEventsCreated: Object.keys(state.cityFeedEventsById).length,
    activePlayers: playerIds.filter((playerId) => state.playersById[playerId]?.status === "active").length,
    eliminatedPlayers: playerIds.filter((playerId) => state.playersById[playerId]?.status === "defeated").length,
    crashedInstances,
    averageHeat: round(average(heats)),
    maxHeat: round(Math.max(0, ...heats)),
    totalResourcesByKey: createTotalResourcesByKey(state, playerIds),
    topPlayersByScore: createTopPlayersByScore(state, playerIds),
    uniqueHomeDistricts: createHomeDistrictIds(state).length,
    connectedMap: isConnectedDistrictGraph(state)
  };
};

const cloneCounters = (
  counters: FreeModeSharedCitySimulationCounters
): FreeModeSharedCitySimulationCounters => ({
  actionsAttempted: counters.actionsAttempted,
  actionsAccepted: counters.actionsAccepted,
  actionsRejected: counters.actionsRejected,
  actionsByType: { ...counters.actionsByType },
  acceptedActionsByType: { ...counters.acceptedActionsByType },
  actionsByProfile: { ...counters.actionsByProfile },
  acceptedActionsByProfile: { ...counters.acceptedActionsByProfile },
  actionsByTypeAndProfile: cloneNestedRecord(counters.actionsByTypeAndProfile),
  errorsByCode: { ...counters.errorsByCode },
  turnsWithoutValidAction: counters.turnsWithoutValidAction,
  turnsWithoutValidActionByProfile: { ...counters.turnsWithoutValidActionByProfile },
  profileAssignmentSummary: { ...counters.profileAssignmentSummary }
});

const cloneNestedRecord = (
  record: Record<string, Record<string, number>>
): Record<string, Record<string, number>> =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, { ...value }]));

export const createStateSummary = (
  state: CoreGameState,
  instanceId: ServerInstanceId
): FreeModeSharedCitySimulationStateSummary => ({
  instanceId,
  playerCount: state.root.playerIds.length,
  districtCount: state.root.districtIds.length,
  tick: state.root.tick,
  connectedMap: isConnectedDistrictGraph(state),
  uniqueHomeDistricts: createHomeDistrictIds(state).length,
  homeDistrictIds: createHomeDistrictIds(state)
});

const countNotifications = (state: CoreGameState, category: string): number =>
  Object.values(state.notificationsById).filter((notification) => notification.category === category).length;

const createHomeDistrictIds = (state: CoreGameState) =>
  [...new Set(state.root.playerIds.map((playerId) => state.playersById[playerId]?.homeDistrictId).filter(Boolean))] as DistrictId[];

const createTotalResourcesByKey = (state: CoreGameState, playerIds: PlayerId[]): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const playerId of playerIds) {
    const resourceState = state.resourceStatesById[state.playersById[playerId]?.resourceStateId ?? ""];
    for (const [key, value] of Object.entries(resourceState?.balances ?? {})) {
      totals[key] = round((totals[key] ?? 0) + value);
    }
  }
  return totals;
};

const createTopPlayersByScore = (state: CoreGameState, playerIds: PlayerId[]) =>
  playerIds
    .map((playerId) => {
      const player = state.playersById[playerId]!;
      const resourceState = state.resourceStatesById[player.resourceStateId];
      const controlledDistricts = state.root.districtIds.filter((districtId) => state.districtsById[districtId]?.ownerPlayerId === playerId).length;
      const influence = state.root.districtIds
        .filter((districtId) => state.districtsById[districtId]?.ownerPlayerId === playerId)
        .reduce((sum, districtId) => sum + (state.districtsById[districtId]?.influence ?? 0), 0);
      const cash = resourceState?.balances.cash ?? 0;
      const dirtyCash = resourceState?.balances["dirty-cash"] ?? 0;
      return { playerId, controlledDistricts, influence, cash, dirtyCash, score: round(controlledDistricts * 1000 + influence * 10 + cash / 100 + dirtyCash / 200) };
    })
    .sort((left, right) => right.score - left.score || left.playerId.localeCompare(right.playerId))
    .slice(0, 5);

const average = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const round = (value: number): number => Math.round(value * 100) / 100;
