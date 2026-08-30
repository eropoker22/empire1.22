import type {
  AttackDistrictCommand,
  HeistDistrictCommand,
  PlayerSpyOperationState,
  RobDistrictCommand,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import {
  finishPendingDistrictActionResolution,
  preparePendingDistrictActionResolution
} from "./pendingDistrictActionShared";
import { resolvePendingAttackDistrict } from "./attackDistrict";
import { resolvePendingHeistDistrict } from "./heistDistrict";
import { resolvePendingRobDistrict } from "./robDistrict";
import { resolvePendingSpyDistrict } from "./spyDistrict";

export const completePendingDistrictActions = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const dueOperations = Object.values(state.pendingDistrictActionOperationsById ?? {})
    .filter((operation) => operation.resolveAtTick <= state.root.tick)
    .sort((left, right) => left.resolveAtTick - right.resolveAtTick || left.id.localeCompare(right.id));
  let nextState = state;
  const events: CoreEvent[] = [];

  for (const operation of dueOperations) {
    const preparedState = preparePendingDistrictActionResolution(nextState, operation);
    const result = operation.operationType === "attack"
      ? resolvePendingAttackDistrict(preparedState, operation.command as AttackDistrictCommand, context, true)
      : operation.operationType === "heist"
        ? resolvePendingHeistDistrict(preparedState, operation.command as HeistDistrictCommand, context, true)
        : operation.operationType === "rob"
          ? resolvePendingRobDistrict(preparedState, operation.command as RobDistrictCommand, context, true)
          : resolvePendingSpyDistrict(preparedState, operation.command as SpyDistrictCommand, context, true);
    nextState = finishPendingDistrictActionResolution(result.nextState, operation);
    if (operation.operationType === "spy") {
      nextState = preserveResolvedSpyPenalty(nextState, operation);
    }
    events.push(...result.events);
  }

  return { nextState, events };
};

const preserveResolvedSpyPenalty = (
  state: CoreGameState,
  operation: NonNullable<CoreGameState["pendingDistrictActionOperationsById"]>[string]
): CoreGameState => {
  const report = state.notificationsById[`notification:${operation.command.id}:spy-report`];
  const blockedUntilTick = Number(report?.payload.blockedUntilTick ?? 0);
  if (!operation.spySlotId || blockedUntilTick <= state.root.tick) return state;
  const player = state.playersById[operation.playerId];
  const spyState = state.playerSpyOperationStatesByPlayerId?.[operation.playerId];
  const cooldownState = player ? state.cooldownStatesById[player.cooldownStateId] : undefined;
  if (!player || !spyState || !cooldownState) return state;
  return {
    ...state,
    playerSpyOperationStatesByPlayerId: {
      ...state.playerSpyOperationStatesByPlayerId,
      [player.id]: {
        ...spyState,
        slots: spyState.slots.map((slot) => slot.slotId === operation.spySlotId
          ? { ...slot, availableAtTick: blockedUntilTick }
          : slot) as PlayerSpyOperationState["slots"]
      }
    },
    cooldownStatesById: {
      ...state.cooldownStatesById,
      [cooldownState.id]: {
        ...cooldownState,
        cooldowns: {
          ...cooldownState.cooldowns,
          [`spy:${operation.targetDistrictId}`]: blockedUntilTick
        }
      }
    }
  };
};
