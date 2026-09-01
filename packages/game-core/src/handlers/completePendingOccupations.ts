import type { PendingOccupyOperation } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { CORE_EVENT_TYPES, createEvent, type CoreEvent } from "../events";
import { appendRecoveryPoolEntries, createRecoveryEntriesFromLosses } from "./clinicBuildingActions";
import { reassignCapturedDistrictBuildings } from "./attackDistrictHelpers";
import { resolveBountyClaims } from "./bountyCommands";
import { increasePlayerPoliceHeat } from "./playerPoliceState";
import {
  countActiveOwnedDistricts,
  reconcilePlayerTerritoryLifecycle
} from "../rules/liveness";
import { bumpDistrictConflictRevision, bumpDistrictSecurityRevision, resolvePlayerPopulation } from "../state";
import { composeEntityId } from "../utils";
import { deterministicUnitInterval } from "../utils/math";
import {
  createOccupyReportNotification,
  resolveOccupyStreetNewsTemplateId
} from "./occupyResolutionSupport";

export const completePendingOccupations = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const dueOperations = Object.values(state.pendingOccupyOperationsById ?? {})
    .filter((operation) => operation.resolveAtTick <= state.root.tick)
    .sort((left, right) => left.resolveAtTick - right.resolveAtTick || left.id.localeCompare(right.id));
  let nextState = state;
  const events: CoreEvent[] = [];

  for (const operation of dueOperations) {
    const result = completePendingOccupation(nextState, operation, context);
    nextState = result.nextState;
    events.push(...result.events);
  }

  return { nextState, events };
};

const completePendingOccupation = (
  state: CoreGameState,
  operation: PendingOccupyOperation,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const player = state.playersById[operation.playerId];
  const sourceDistrict = state.districtsById[operation.sourceDistrictId];
  const targetDistrict = state.districtsById[operation.targetDistrictId];
  if (!player || !sourceDistrict || !targetDistrict) {
    return { nextState: removePendingOperation(state, operation.id), events: [] };
  }

  const validAtResolution = player.status === "active"
    && sourceDistrict.ownerPlayerId === player.id
    && !targetDistrict.ownerPlayerId
    && targetDistrict.status !== "destroyed"
    && targetDistrict.status !== "locked";
  const occupyRoll = deterministicUnitInterval(
    `${state.serverInstance.worldSeed}:occupy:${operation.commandId}:${player.id}:${targetDistrict.id}:${operation.issuedAtTick}`
  );
  const occupySucceeded = validAtResolution && occupyRoll >= operation.failureChancePct / 100;
  const result = occupySucceeded ? "success" : "failure";
  const populationRefunded = occupySucceeded
    ? Math.max(0, Math.floor(operation.populationCost * operation.populationRefundPct / 100))
    : 0;
  const populationLost = Math.max(0, operation.populationCost - populationRefunded);
  const streetNewsTemplateId = resolveOccupyStreetNewsTemplateId({
    commandId: operation.commandId,
    result,
    targetDistrictId: targetDistrict.id,
    tick: state.root.tick,
    worldSeed: state.serverInstance.worldSeed
  });
  const nextPoliceState = increasePlayerPoliceHeat(state, player, operation.heatGain, state.root.tick);
  const eventId = composeEntityId("event", `${operation.commandId}:occupy-${result}`);
  const report = createOccupyReportNotification({
    operation,
    result,
    populationLost,
    populationRefunded,
    tick: state.root.tick,
    eventId,
    streetNewsTemplateId
  });
  const pendingOccupyOperationsById = { ...(state.pendingOccupyOperationsById ?? {}) };
  delete pendingOccupyOperationsById[operation.id];
  const targetAfterResolution = (occupySucceeded
    ? bumpDistrictSecurityRevision
    : bumpDistrictConflictRevision)({
      ...targetDistrict,
      ...(occupySucceeded ? {
        ownerPlayerId: player.id,
        controllerAllianceId: player.allianceId,
        status: "claimed" as const,
        stabilizingUntilTick: state.root.tick + Math.max(
          0,
          Number(context.config.balance.conflict?.captureStabilization?.durationTicks ?? 0)
        ),
        ownershipStartedAtTick: state.root.tick
      } : {}),
      heat: Math.max(0, Number(targetDistrict.heat || 0) + operation.heatGain),
      lastHeatDecayTick: state.root.tick,
      version: targetDistrict.version + 1
    });
  const stateAfterResolution: CoreGameState = {
    ...state,
    pendingOccupyOperationsById,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        population: Math.max(0, resolvePlayerPopulation(state, player) + populationRefunded),
        version: player.version + 1
      }
    },
    districtsById: { ...state.districtsById, [targetDistrict.id]: targetAfterResolution },
    buildingsById: occupySucceeded
      ? reassignCapturedDistrictBuildings(state, targetDistrict.buildingIds, player.id)
      : state.buildingsById,
    resourceStatesById: state.resourceStatesById,
    policeStatesById: { ...state.policeStatesById, [nextPoliceState.id]: nextPoliceState },
    notificationsById: { ...state.notificationsById, [report.id]: report },
    root: {
      ...state.root,
      notificationIds: state.root.notificationIds.includes(report.id)
        ? state.root.notificationIds
        : [...state.root.notificationIds, report.id],
      version: state.root.version + 1
    }
  };
  const stateWithRecovery = appendRecoveryPoolEntries(
    stateAfterResolution,
    player.id,
    createRecoveryEntriesFromLosses({ population: populationLost }, "occupy"),
    `${operation.commandId}:occupy`
  );
  const occupyEventPayload = {
    attackerPlayerId: player.id,
    districtId: targetDistrict.id,
    previousOwnerPlayerId: null,
    sourceDistrictId: sourceDistrict.id,
    actionType: "occupy-district",
    result,
    districtCaptured: occupySucceeded,
    heatGained: operation.heatGain,
    influenceCost: operation.influenceCost,
    populationCost: operation.populationCost,
    populationLost,
    populationRefunded,
    failureChancePct: operation.failureChancePct,
    successChancePct: 100 - operation.failureChancePct,
    cooldownTicks: operation.cooldownTicks,
    issuedAtTick: operation.issuedAtTick,
    resolveAtTick: operation.resolveAtTick,
    eventId,
    streetNewsTemplateId
  };
  const resolutionEvents = [
    createEvent(
      occupySucceeded ? CORE_EVENT_TYPES.districtCaptured : CORE_EVENT_TYPES.districtOccupyResolved,
      occupyEventPayload
    ),
    createEvent(CORE_EVENT_TYPES.notificationCreated, {
      notificationId: report.id,
      recipientId: player.id,
      category: report.category
    })
  ];
  if (!occupySucceeded) return { nextState: stateWithRecovery, events: resolutionEvents };

  const bountyResult = resolveBountyClaims(stateWithRecovery, {
    actorPlayerId: player.id,
    targetPlayerId: null,
    targetDistrictId: targetDistrict.id,
    actionType: "occupy-district",
    successfulAttack: false,
    capturesDistrict: true,
    destroysDistrict: false,
    commandId: operation.commandId
  });
  const lifecycle = reconcilePlayerTerritoryLifecycle(bountyResult.nextState, {
    playerId: player.id,
    previousActiveDistrictCount: countActiveOwnedDistricts(state, player.id),
    sourceEventId: operation.commandId,
    issuedAt: operation.resolveAt
  }, context);
  return {
    nextState: lifecycle.nextState,
    events: [...resolutionEvents, ...bountyResult.events, ...lifecycle.events]
  };
};

const removePendingOperation = (state: CoreGameState, operationId: string): CoreGameState => {
  const pendingOccupyOperationsById = { ...(state.pendingOccupyOperationsById ?? {}) };
  delete pendingOccupyOperationsById[operationId];
  return {
    ...state,
    pendingOccupyOperationsById,
    root: { ...state.root, version: state.root.version + 1 }
  };
};
