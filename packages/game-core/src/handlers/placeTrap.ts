import type {
  CooldownState,
  DistrictTrap,
  PlaceTrapCommand
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { composeEntityId } from "../utils";
import { validatePlaceTrap } from "../validation";
import { bumpDistrictSecurityRevision } from "../state";

/**
 * Responsibility: Orchestrates one authoritative hidden trap placement.
 * Belongs here: command-scoped trap persistence and event emission.
 * Does not belong here: projection visibility rules or transport delivery.
 */
export const handlePlaceTrap = (
  state: CoreGameState,
  command: PlaceTrapCommand,
  _context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validatePlaceTrap(state, command);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const player = state.playersById[command.playerId];
  const district = state.districtsById[command.payload.districtId];
  const trapId = composeEntityId("trap", district.id);
  const previousTrap = state.trapsById[trapId];
  const trap: DistrictTrap = {
    id: trapId,
    serverInstanceId: state.serverInstance.id,
    districtId: district.id,
    ownerPlayerId: command.playerId,
    status: "active",
    placedAtTick: state.root.tick,
    triggeredAtTick: null,
    version: previousTrap ? previousTrap.version + 1 : 1
  };

  const nextState: CoreGameState = {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        lastActionAt: command.issuedAt,
        version: player.version + 1
      }
    },
    trapsById: {
      ...state.trapsById,
      [trap.id]: trap
    },
    districtsById: {
      ...state.districtsById,
      [district.id]: bumpDistrictSecurityRevision({
        ...district,
        version: district.version + 1
      })
    },
    root: {
      ...state.root,
      trapIds: state.root.trapIds.includes(trap.id)
        ? state.root.trapIds
        : [...state.root.trapIds, trap.id],
      version: state.root.version + (state.root.trapIds.includes(trap.id) ? 0 : 1)
    }
  };

  return {
    nextState,
    events: [
      createEvent(CORE_EVENT_TYPES.trapPlaced, {
        trapId: trap.id,
        districtId: district.id,
        playerId: player.id
      })
    ],
    errors: []
  };
};
