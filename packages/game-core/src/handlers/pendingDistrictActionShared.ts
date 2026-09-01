import type {
  AttackWeaponId,
  DistrictOperationType,
  PendingDistrictActionOperation,
  PlayerSpyOperationState
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { applyDistrictOperationLock } from "../rules";
import { bumpDistrictConflictRevision } from "../state";
import { getAttackWeaponInventory } from "../validation";
import { createPlayerCooldownState } from "./attackDistrictHelpers";
import { writeAttackWeaponInventory } from "./attackWeaponInventory";

export const startPendingDistrictAction = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation
): CoreGameState => {
  const player = state.playersById[operation.playerId];
  const targetDistrict = state.districtsById[operation.targetDistrictId];
  if (!player || !targetDistrict) return state;

  const storedCooldownState = state.cooldownStatesById[player.cooldownStateId];
  const cooldownState = storedCooldownState
    ?? createPlayerCooldownState(player.id, player.cooldownStateId);
  const cooldowns = { ...cooldownState.cooldowns };
  for (const key of operation.cooldownKeys) {
    cooldowns[key] = Math.max(Number(cooldowns[key] ?? 0), operation.resolveAtTick);
  }

  let playerSpyOperationStatesByPlayerId = state.playerSpyOperationStatesByPlayerId;
  if (operation.spySlotId) {
    const spyState = state.playerSpyOperationStatesByPlayerId?.[player.id];
    if (spyState) {
      playerSpyOperationStatesByPlayerId = {
        ...state.playerSpyOperationStatesByPlayerId,
        [player.id]: {
          ...spyState,
          slots: spyState.slots.map((slot) => slot.slotId === operation.spySlotId
            ? { ...slot, availableAtTick: operation.resolveAtTick, lastMissionId: operation.command.id }
            : slot) as PlayerSpyOperationState["slots"],
          version: spyState.version + 1
        }
      };
    }
  }

  return {
    ...state,
    pendingDistrictActionOperationsById: {
      ...(state.pendingDistrictActionOperationsById ?? {}),
      [operation.id]: operation
    },
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        lastActionAt: operation.command.issuedAt,
        version: player.version + 1
      }
    },
    districtsById: {
      ...state.districtsById,
      [targetDistrict.id]: bumpDistrictConflictRevision(applyDistrictOperationLock(
        targetDistrict,
        operation.operationType,
        operation.resolveAtTick
      ))
    },
    cooldownStatesById: {
      ...state.cooldownStatesById,
      [cooldownState.id]: {
        ...cooldownState,
        cooldowns,
        version: cooldownState.version + (storedCooldownState ? 1 : 0)
      }
    },
    playerSpyOperationStatesByPlayerId,
    root: { ...state.root, version: state.root.version + 1 }
  };
};

export const preparePendingDistrictActionResolution = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation
): CoreGameState => restoreReservedAttackLoadout(
  restoreReservedPopulation(clearPendingDistrictActionState(state, operation), operation),
  operation
);

export const finishPendingDistrictActionResolution = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation
): CoreGameState => {
  const pendingDistrictActionOperationsById = {
    ...(state.pendingDistrictActionOperationsById ?? {})
  };
  delete pendingDistrictActionOperationsById[operation.id];
  return { ...state, pendingDistrictActionOperationsById };
};

const clearPendingDistrictActionState = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation
): CoreGameState => {
  const pendingDistrictActionOperationsById = {
    ...(state.pendingDistrictActionOperationsById ?? {})
  };

  const player = state.playersById[operation.playerId];
  const cooldownState = player ? state.cooldownStatesById[player.cooldownStateId] : undefined;
  const cooldownStatesById = { ...state.cooldownStatesById };
  if (cooldownState) {
    const cooldowns = { ...cooldownState.cooldowns };
    for (const key of operation.cooldownKeys) delete cooldowns[key];
    cooldownStatesById[cooldownState.id] = { ...cooldownState, cooldowns };
  }

  const targetDistrict = state.districtsById[operation.targetDistrictId];
  const districtsById = { ...state.districtsById };
  if (targetDistrict) {
    const operationLocks = { ...targetDistrict.operationLocks };
    delete operationLocks[operation.operationType as DistrictOperationType];
    districtsById[targetDistrict.id] = { ...targetDistrict, operationLocks };
  }

  let playerSpyOperationStatesByPlayerId = state.playerSpyOperationStatesByPlayerId;
  if (operation.spySlotId && player) {
    const spyState = state.playerSpyOperationStatesByPlayerId?.[player.id];
    if (spyState) {
      playerSpyOperationStatesByPlayerId = {
        ...state.playerSpyOperationStatesByPlayerId,
        [player.id]: {
          ...spyState,
          slots: spyState.slots.map((slot) => slot.slotId === operation.spySlotId
            ? { ...slot, availableAtTick: state.root.tick }
            : slot) as PlayerSpyOperationState["slots"]
        }
      };
    }
  }

  return {
    ...state,
    pendingDistrictActionOperationsById,
    cooldownStatesById,
    districtsById,
    playerSpyOperationStatesByPlayerId
  };
};

const restoreReservedAttackLoadout = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation
): CoreGameState => {
  if (operation.operationType !== "attack" || !operation.reservedAttackLoadout) return state;
  const player = state.playersById[operation.playerId];
  if (!player) return state;
  const inventory = getAttackWeaponInventory(state, player);
  const restoredInventory = { ...inventory };
  for (const [weaponId, rawAmount] of Object.entries(operation.reservedAttackLoadout) as Array<[AttackWeaponId, number]>) {
    restoredInventory[weaponId] = Math.max(0, Number(restoredInventory[weaponId] ?? 0))
      + Math.max(0, Number(rawAmount ?? 0));
  }
  return {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: { ...player, attackLoadout: restoredInventory }
    },
    resourceStatesById: writeAttackWeaponInventory(state, player, restoredInventory)
  };
};

const restoreReservedPopulation = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation
): CoreGameState => {
  const reservedPopulation = Math.max(0, Number(operation.reservedPopulation ?? 0));
  if (operation.operationType !== "heist" || reservedPopulation <= 0) return state;
  const player = state.playersById[operation.playerId];
  if (!player) return state;
  return {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        population: Math.max(0, Number(player.population ?? 0)) + reservedPopulation,
        version: player.version + 1
      }
    }
  };
};
