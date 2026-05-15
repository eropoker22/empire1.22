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
import type { SimulationActionType, SimulationBotProfile } from "./types";

export const recordSimulationResponse = (
  response: GameplaySliceResponse,
  counters: ReturnType<typeof createInitialSimulationCounters>,
  actionType: SimulationActionType,
  profile: SimulationBotProfile
): void => {
  counters.actionsAttempted += 1;
  incrementRecord(counters.actionsByType, actionType);
  incrementRecord(counters.actionsByProfile, profile);
  incrementNestedRecord(counters.actionsByTypeAndProfile, actionType, profile);

  if (response.accepted) {
    counters.actionsAccepted += 1;
    incrementRecord(counters.acceptedActionsByType, actionType);
    incrementRecord(counters.acceptedActionsByProfile, profile);
    return;
  }

  counters.actionsRejected += 1;
  for (const error of response.errors) incrementRecord(counters.errorsByCode, error.code);
};

export const recordNoValidAction = (
  counters: ReturnType<typeof createInitialSimulationCounters>,
  profile: SimulationBotProfile
): void => {
  counters.turnsWithoutValidAction += 1;
  incrementRecord(counters.turnsWithoutValidActionByProfile, profile);
};

export const recordProfileAssignment = (
  counters: ReturnType<typeof createInitialSimulationCounters>,
  profile: SimulationBotProfile
): void => {
  incrementRecord(counters.profileAssignmentSummary, profile);
};

const incrementNestedRecord = (
  record: Record<string, Record<string, number>>,
  outerKey: string,
  innerKey: string
): void => {
  record[outerKey] ??= {};
  incrementRecord(record[outerKey], innerKey);
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
