import type {
  AttackDistrictCommand,
  CollectProductionCommand,
  DistrictId,
  GameplaySliceResponse,
  PlayerId,
  ServerInstanceId,
  SpyDistrictCommand
} from "@empire/shared-types";
import { createInitialSimulationCounters, incrementRecord } from "./metrics";
import type { SimulationActionType } from "./types";

export const recordSimulationResponse = (
  response: GameplaySliceResponse,
  counters: ReturnType<typeof createInitialSimulationCounters>,
  actionType: SimulationActionType
): void => {
  counters.actionsAttempted += 1;
  incrementRecord(counters.actionsByType, actionType);

  if (response.accepted) {
    counters.actionsAccepted += 1;
    incrementRecord(counters.acceptedActionsByType, actionType);
    return;
  }

  counters.actionsRejected += 1;
  for (const error of response.errors) incrementRecord(counters.errorsByCode, error.code);
};

export const createSpyCommand = (
  serverInstanceId: ServerInstanceId,
  playerId: PlayerId,
  sourceDistrictId: DistrictId,
  targetDistrictId: DistrictId,
  round: number,
  playerIndex: number
): SpyDistrictCommand => ({
  id: createCommandId("spy-district", round, playerIndex, sourceDistrictId, targetDistrictId),
  type: "spy-district",
  mode: "free",
  playerId,
  serverInstanceId,
  issuedAt: new Date(0).toISOString(),
  payload: { districtId: targetDistrictId, sourceDistrictId },
  clientRequestId: null
});

export const createAttackCommand = (
  serverInstanceId: ServerInstanceId,
  playerId: PlayerId,
  sourceDistrictId: DistrictId,
  targetDistrictId: DistrictId,
  round: number,
  playerIndex: number
): AttackDistrictCommand => ({
  id: createCommandId("attack-district", round, playerIndex, sourceDistrictId, targetDistrictId),
  type: "attack-district",
  mode: "free",
  playerId,
  serverInstanceId,
  issuedAt: new Date(0).toISOString(),
  payload: { districtId: targetDistrictId, sourceDistrictId },
  clientRequestId: null
});

export const createCollectCommand = (
  serverInstanceId: ServerInstanceId,
  playerId: PlayerId,
  districtId: DistrictId,
  buildingId: string,
  round: number,
  playerIndex: number
): CollectProductionCommand => ({
  id: createCommandId("collect-production", round, playerIndex, districtId, buildingId),
  type: "collect-production",
  mode: "free",
  playerId,
  serverInstanceId,
  issuedAt: new Date(0).toISOString(),
  payload: { districtId, buildingId },
  clientRequestId: null
});

const createCommandId = (
  actionType: SimulationActionType,
  round: number,
  playerIndex: number,
  source: string,
  target: string
): string =>
  `command:free-shared-city-sim:${round}:${playerIndex + 1}:${actionType}:${source}:${target}`;
