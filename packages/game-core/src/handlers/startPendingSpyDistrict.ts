import type { PendingDistrictActionOperation, SpyDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { resolvePlayerSpyBoostEffects } from "../rules";
import { getPlayerSpyOperationState, resolveAvailableSpySlot, validateSpy } from "../validation";
import { applyGarageCooldownReductionTicks } from "./garageBuildingActions";
import { startPendingDistrictAction } from "./pendingDistrictActionShared";

export const handleSpyDistrict = (
  state: CoreGameState,
  command: SpyDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateSpy(state, command);
  if (errors.length > 0) return { nextState: state, events: [], errors };
  const player = state.playersById[command.playerId];
  const spyOperationState = getPlayerSpyOperationState(state, player.id);
  const selectedSlot = resolveAvailableSpySlot(state, player.id)!;
  const targetDistrict = state.districtsById[command.payload.districtId];
  const boostSnapshot = resolvePlayerSpyBoostEffects(state, player.id);
  const baseSpySlotCooldownTicks = context.config.balance.conflict?.spySlotCooldownTicks
    ?? context.config.balance.conflict?.spyCooldownTicks
    ?? 2;
  const spyCooldownTicks = applyGarageCooldownReductionTicks({
    baseTicks: baseSpySlotCooldownTicks,
    state,
    playerId: player.id,
    config: context.config.balance.garage,
    category: "districtSpy"
  });
  const operation: PendingDistrictActionOperation = {
    id: `district-action-operation:${command.id}`,
    operationType: "spy",
    command,
    playerId: player.id,
    sourceDistrictId: command.payload.sourceDistrictId,
    targetDistrictId: targetDistrict.id,
    targetOwnerPlayerId: targetDistrict.ownerPlayerId ?? null,
    issuedAtTick: state.root.tick,
    resolveAtTick: state.root.tick + Math.max(1, Math.ceil(spyCooldownTicks * boostSnapshot.spyDurationMultiplier)),
    cooldownKeys: [`spy:${targetDistrict.id}`],
    spySlotId: selectedSlot.slotId,
    spyBoostSnapshot: boostSnapshot,
    version: 1
  };
  const stateWithSpySlots = state.playerSpyOperationStatesByPlayerId?.[player.id]
    ? state
    : {
        ...state,
        playerSpyOperationStatesByPlayerId: {
          ...state.playerSpyOperationStatesByPlayerId,
          [player.id]: spyOperationState
        }
      };
  return { nextState: startPendingDistrictAction(stateWithSpySlots, operation), events: [], errors: [] };
};
