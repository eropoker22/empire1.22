import type {
  DistrictId,
  GameplaySliceView,
  LoadGameplaySliceRequest,
  PlayerId,
  ServerInstanceId
} from "@empire/shared-types";
import { createServerApp } from "../../../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../../../apps/server/src/bootstrap/gameplay-slice-session-bootstrap";
import { selectSimulationAction } from "./action-selection";
import { createSpyCommand, recordSimulationResponse } from "./commands";
import {
  createInitialSimulationCounters,
  createSimulationReport,
  createStateSummary,
  incrementRecord
} from "./metrics";
import type { FreeModeSharedCitySimulationOptions, FreeModeSharedCitySimulationResult } from "./types";

const DEFAULT_INSTANCE_ID = "instance:free-shared-city-simulation";
const DEFAULT_PLAYER_COUNT = 20;
const DEFAULT_ROUNDS = 10;
const DEFAULT_TICKS_PER_ROUND = 3;

export const runFreeModeSimulation = async (
  options: FreeModeSharedCitySimulationOptions = {}
): Promise<FreeModeSharedCitySimulationResult> => {
  const server = createServerApp();
  const instanceId = options.instanceId ?? DEFAULT_INSTANCE_ID;
  const playerCount = Math.max(1, Math.floor(options.playerCount ?? DEFAULT_PLAYER_COUNT));
  const rounds = Math.max(0, Math.floor(options.rounds ?? DEFAULT_ROUNDS));
  const ticksPerRound = Math.max(0, Math.floor(options.ticksPerRound ?? DEFAULT_TICKS_PER_ROUND));
  const playerIds = Array.from({ length: playerCount }, (_, index) => `player:free-sim:${index + 1}` as PlayerId);
  const counters = createInitialSimulationCounters();
  const spiedRoutes = new Set<string>();

  for (const [index, playerId] of playerIds.entries()) {
    const result = await ensureGameplaySliceSessionResult(
      server.instanceManager,
      createLoadRequest(instanceId, playerId, index + 1)
    );
    if (!result.accepted) {
      for (const error of result.errors) incrementRecord(counters.errorsByCode, error.code);
    }
  }

  for (let round = 1; round <= rounds; round += 1) {
    for (const [playerIndex, playerId] of playerIds.entries()) {
      const runtime = server.instanceManager.getInstanceById(instanceId);
      if (!runtime || runtime.state.playersById[playerId]?.status !== "active") continue;
      const action = selectSimulationAction(
        runtime,
        playerId,
        round,
        playerIndex,
        spiedRoutes,
        (districtId) => loadGameplaySliceView(server, instanceId, playerId, districtId)
      );

      if (!action) {
        counters.turnsWithoutValidAction += 1;
        continue;
      }

      const response = server.gameplaySliceTransport.submit({
        focusDistrictId: action.focusDistrictId,
        command: action.command
      });
      recordSimulationResponse(response, counters, action.command.type);
      if (response.accepted && action.routeKey) spiedRoutes.add(action.routeKey);
    }

    for (let tick = 0; tick < ticksPerRound; tick += 1) {
      server.instanceManager.tickInstance(instanceId);
    }
  }

  if (options.includeInvalidProbe) {
    submitInvalidProbe(instanceId, server, counters);
  }

  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) return createEmptySimulationResult(instanceId, counters);

  const report = createSimulationReport(runtime.state, counters, server.instanceManager.getHealthSummary().crashedInstances);
  return {
    report,
    finalStateSummary: createStateSummary(runtime.state, instanceId),
    errorsByCode: report.errorsByCode
  };
};

const createLoadRequest = (
  instanceId: ServerInstanceId,
  playerId: PlayerId,
  index: number
): LoadGameplaySliceRequest => ({
  serverInstanceId: instanceId,
  playerId,
  districtId: `district:free-sim-request:${index}`,
  factionId: "mafian"
});

const submitInvalidProbe = (
  instanceId: ServerInstanceId,
  server: ReturnType<typeof createServerApp>,
  counters: ReturnType<typeof createInitialSimulationCounters>
): void => {
  const runtime = server.instanceManager.getInstanceById(instanceId);
  const playerId = runtime?.state.root.playerIds[0];
  const homeDistrictId = playerId ? runtime?.state.playersById[playerId]?.homeDistrictId : null;
  if (!playerId || !homeDistrictId) return;

  recordSimulationResponse(
    server.gameplaySliceTransport.submit({
      focusDistrictId: "district:invalid-probe",
      command: createSpyCommand(instanceId, playerId, homeDistrictId, "district:missing-invalid-probe", 0, 0)
    }),
    counters,
    "spy-district"
  );
};

const loadGameplaySliceView = (
  server: ReturnType<typeof createServerApp>,
  instanceId: ServerInstanceId,
  playerId: PlayerId,
  districtId: DistrictId
): GameplaySliceView | null =>
  server.gameplaySliceTransport.load({
    serverInstanceId: instanceId,
    playerId,
    districtId,
    factionId: null
  }).readModel;

const createEmptySimulationResult = (
  instanceId: ServerInstanceId,
  counters: ReturnType<typeof createInitialSimulationCounters>
): FreeModeSharedCitySimulationResult => ({
  report: {
    ...counters,
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
    connectedMap: true
  },
  finalStateSummary: {
    instanceId,
    playerCount: 0,
    districtCount: 0,
    tick: 0,
    connectedMap: true,
    uniqueHomeDistricts: 0,
    homeDistrictIds: [] as DistrictId[]
  },
  errorsByCode: counters.errorsByCode
});
