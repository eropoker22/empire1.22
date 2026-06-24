import type { PlaceDefenseCommand, RemoveDefenseCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { validatePlaceDefense, validateRemoveDefense } from "../validation";

export const handlePlaceDefense = (
  state: CoreGameState,
  command: PlaceDefenseCommand,
  _context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validatePlaceDefense(state, command);
  if (errors.length > 0) return { nextState: state, events: [], errors };

  const player = state.playersById[command.playerId]!;
  const district = state.districtsById[command.payload.targetDistrictId]!;
  const resource = state.resourceStatesById[player.resourceStateId];
  const currentInventory = Math.max(0, Number(resource?.balances[command.payload.defenseItemId] || 0));
  if (!resource || currentInventory < command.payload.amount) {
    return {
      nextState: state,
      events: [],
      errors: [{
        code: "INSUFFICIENT_RESOURCES",
        message: "Not enough defense items in player inventory.",
        details: { defenseItemId: command.payload.defenseItemId, amount: command.payload.amount }
      }]
    };
  }

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: { ...player, lastActionAt: command.issuedAt, version: player.version + 1 }
      },
      districtsById: {
        ...state.districtsById,
        [district.id]: {
          ...district,
          defenseLoadout: {
            ...district.defenseLoadout,
            [command.payload.defenseItemId]: Math.max(0, Number(district.defenseLoadout[command.payload.defenseItemId] || 0)) + command.payload.amount
          },
          version: district.version + 1
        }
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [resource.id]: {
          ...resource,
          balances: {
            ...resource.balances,
            [command.payload.defenseItemId]: currentInventory - command.payload.amount
          },
          lastUpdatedTick: state.root.tick,
          version: resource.version + 1
        }
      },
      root: { ...state.root, version: state.root.version + 1 }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.defensePlaced, {
        playerId: player.id,
        targetDistrictId: district.id,
        defenseItemId: command.payload.defenseItemId,
        amount: command.payload.amount
      })
    ],
    errors: []
  };
};

export const handleRemoveDefense = (
  state: CoreGameState,
  command: RemoveDefenseCommand,
  _context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateRemoveDefense(state, command);
  if (errors.length > 0) return { nextState: state, events: [], errors };

  const player = state.playersById[command.playerId]!;
  const district = state.districtsById[command.payload.targetDistrictId]!;
  const currentPlaced = Math.max(0, Number(district.defenseLoadout[command.payload.defenseItemId] || 0));
  if (currentPlaced < command.payload.amount) {
    return {
      nextState: state,
      events: [],
      errors: [{
        code: "DEFENSE_NOT_OWNED",
        message: "Not enough placed defense items to remove.",
        details: { defenseItemId: command.payload.defenseItemId, amount: command.payload.amount }
      }]
    };
  }

  const resource = state.resourceStatesById[player.resourceStateId] ?? {
    id: player.resourceStateId,
    ownerType: "player" as const,
    ownerId: player.id,
    balances: {},
    incomeModifiers: {},
    lastUpdatedTick: state.root.tick,
    version: 1
  };

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: { ...player, lastActionAt: command.issuedAt, version: player.version + 1 }
      },
      districtsById: {
        ...state.districtsById,
        [district.id]: {
          ...district,
          defenseLoadout: {
            ...district.defenseLoadout,
            [command.payload.defenseItemId]: currentPlaced - command.payload.amount
          },
          version: district.version + 1
        }
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [resource.id]: {
          ...resource,
          balances: {
            ...resource.balances,
            [command.payload.defenseItemId]: Math.max(0, Number(resource.balances[command.payload.defenseItemId] || 0)) + command.payload.amount
          },
          lastUpdatedTick: state.root.tick,
          version: resource.version + (state.resourceStatesById[resource.id] ? 1 : 0)
        }
      },
      root: { ...state.root, version: state.root.version + 1 }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.defenseRemoved, {
        playerId: player.id,
        targetDistrictId: district.id,
        defenseItemId: command.payload.defenseItemId,
        amount: command.payload.amount
      })
    ],
    errors: []
  };
};
