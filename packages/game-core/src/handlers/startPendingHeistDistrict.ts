import type { HeistDistrictCommand, PendingDistrictActionOperation } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import {
  createHeistAttackerTargetCooldownKey,
  createHeistGlobalCooldownKey,
  createSourceConflictLockKey,
  MAJOR_OFFENSE_COOLDOWN_KEY
} from "../rules";
import { resolvePlayerPopulation } from "../state";
import { validateHeist } from "../validation";
import { resolveSingleOwnedOrigin } from "./conflictReportNotifications";
import { startPendingDistrictAction } from "./pendingDistrictActionShared";

export const handleHeistDistrict = (
  state: CoreGameState,
  command: HeistDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateHeist(state, command, context.config.balance.conflict);
  if (errors.length > 0) return { nextState: state, events: [], errors };
  const config = context.config.balance.conflict?.heist;
  if (!config) return { nextState: state, events: [], errors: [{ code: "HEIST_CONFIG_MISSING", message: "Canonical heist config is unavailable." }] };
  const player = state.playersById[command.playerId]!;
  const targetDistrict = state.districtsById[command.payload.targetDistrictId]!;
  const sourceDistrictId = command.payload.sourceDistrictId
    ?? resolveSingleOwnedOrigin(state, player.id, targetDistrict.id)!;
  const reservedPopulation = Math.max(0, Math.floor(command.payload.populationSent));
  const operation: PendingDistrictActionOperation = {
    id: `district-action-operation:${command.id}`,
    operationType: "heist",
    command,
    playerId: player.id,
    sourceDistrictId,
    targetDistrictId: targetDistrict.id,
    targetOwnerPlayerId: targetDistrict.ownerPlayerId ?? null,
    issuedAtTick: state.root.tick,
    resolveAtTick: state.root.tick + Math.max(1, config.globalCooldownTicks),
    reservedPopulation,
    cooldownKeys: [
      createHeistGlobalCooldownKey(),
      createHeistAttackerTargetCooldownKey(targetDistrict.id),
      MAJOR_OFFENSE_COOLDOWN_KEY,
      createSourceConflictLockKey(sourceDistrictId)
    ],
    version: 1
  };
  const stateWithReservedCrew: CoreGameState = {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        population: Math.max(0, resolvePlayerPopulation(state, player) - reservedPopulation)
      }
    }
  };
  return { nextState: startPendingDistrictAction(stateWithReservedCrew, operation), events: [], errors: [] };
};
