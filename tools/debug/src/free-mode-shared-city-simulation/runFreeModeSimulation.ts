import type {
  DistrictId,
  GameplaySliceView,
  LoadGameplaySliceRequest,
  PlayerFactionId,
  PlayerId,
  ServerInstanceId
} from "@empire/shared-types";
import { createServerApp } from "../../../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../../../apps/server/src/bootstrap/gameplay-slice-session-bootstrap";
import { selectSimulationAction } from "./action-selection";
import { getBotProfileForPlayer } from "./bot-profiles";
import {
  createSpyCommand,
  recordNoValidAction,
  recordProfileAssignment,
  recordSimulationResponse
} from "./commands";
import {
  createFinalSimulationReport,
  createInitialSimulationCounters,
  createSimulationReport,
  createStateSummary,
  incrementRecord
} from "./metrics";
import { createRoundMetrics, createZeroFinalReport } from "./timeline";
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
  const playerProfiles = new Map<PlayerId, ReturnType<typeof getBotProfileForPlayer>>();
  const perRound = [];
  let previousRoundReport = createZeroFinalReport();

  for (const [index, playerId] of playerIds.entries()) {
    const profile = getBotProfileForPlayer(index, options);
    playerProfiles.set(playerId, profile);
    recordProfileAssignment(counters, profile);
    const result = await ensureGameplaySliceSessionResult(
      server.instanceManager,
      createLoadRequest(instanceId, playerId, index + 1, options.factionRotation)
    );
    if (!result.accepted) {
      for (const error of result.errors) incrementRecord(counters.errorsByCode, error.code);
    }
  }

  for (let round = 1; round <= rounds; round += 1) {
    for (const [playerIndex, playerId] of playerIds.entries()) {
      const runtime = server.instanceManager.getInstanceById(instanceId);
      if (!runtime || runtime.state.playersById[playerId]?.status !== "active") continue;
      const profile = playerProfiles.get(playerId) ?? getBotProfileForPlayer(playerIndex, options);
      const action = selectSimulationAction(
        runtime,
        playerId,
        round,
        playerIndex,
        spiedRoutes,
        profile,
        (districtId) => loadGameplaySliceView(server, instanceId, playerId, districtId)
      );

      if (!action) {
        recordNoValidAction(counters, profile);
        continue;
      }

      const response = server.gameplaySliceTransport.submit({
        focusDistrictId: action.focusDistrictId,
        command: action.command
      });
      recordSimulationResponse(response, counters, action.command.type, profile);
      if (response.accepted && action.routeKey) spiedRoutes.add(action.routeKey);
    }

    for (let tick = 0; tick < ticksPerRound; tick += 1) {
      server.instanceManager.tickInstance(instanceId);
    }

    const runtimeAfterRound = server.instanceManager.getInstanceById(instanceId);
    if (runtimeAfterRound) {
      const currentRoundReport = createFinalSimulationReport(
        runtimeAfterRound.state,
        counters,
        server.instanceManager.getHealthSummary().crashedInstances
      );
      perRound.push(createRoundMetrics(round, currentRoundReport, previousRoundReport));
      previousRoundReport = currentRoundReport;
    }
  }

  if (options.includeInvalidProbe) {
    submitInvalidProbe(instanceId, server, counters, playerProfiles);
  }

  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) return createEmptySimulationResult(instanceId, counters);

  const report = createSimulationReport(
    runtime.state,
    counters,
    server.instanceManager.getHealthSummary().crashedInstances,
    perRound,
    playerCount,
    rounds > 0 && ticksPerRound > 0 ? 1 : 0
  );
  return {
    report,
    finalStateSummary: createStateSummary(runtime.state, instanceId),
    errorsByCode: report.errorsByCode
  };
};

const createLoadRequest = (
  instanceId: ServerInstanceId,
  playerId: PlayerId,
  index: number,
  factionRotation: PlayerFactionId[] | undefined
): LoadGameplaySliceRequest => ({
  serverInstanceId: instanceId,
  playerId,
  districtId: `district:free-sim-request:${index}`,
  factionId: resolveFactionId(index, factionRotation)
});

const resolveFactionId = (
  index: number,
  factionRotation: PlayerFactionId[] | undefined
): PlayerFactionId =>
  factionRotation?.[(index - 1) % factionRotation.length] ?? "mafian";

const submitInvalidProbe = (
  instanceId: ServerInstanceId,
  server: ReturnType<typeof createServerApp>,
  counters: ReturnType<typeof createInitialSimulationCounters>,
  playerProfiles: Map<PlayerId, ReturnType<typeof getBotProfileForPlayer>>
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
    "spy-district",
    playerProfiles.get(playerId) ?? "scout"
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
): FreeModeSharedCitySimulationResult => {
  const final = { ...createZeroFinalReport(), ...counters };
  return {
    report: {
      ...final,
      roundsPlayed: 0,
      perRound: [],
      final,
      kpi: {
        hardPassed: false,
        hardAssertions: [],
        softWarnings: [],
        actionAcceptanceRate: 0,
        turnsWithoutValidActionRate: 0,
        spyToAttackRatio: 0
      }
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
  };
};
