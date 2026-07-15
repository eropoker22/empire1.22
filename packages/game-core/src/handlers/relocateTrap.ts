import type { RelocateTrapCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import { bumpDistrictSecurityRevision } from "../state";
import { TRAP_RELOCATION_COOLDOWN_KEY, validateRelocateTrap } from "../validation";
import { createPlayerCooldownState } from "./attackDistrictHelpers";

export const handleRelocateTrap = (
  state: CoreGameState,
  command: RelocateTrapCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateRelocateTrap(state, command);
  if (errors.length > 0) return { nextState: state, events: [], errors };
  const player = state.playersById[command.playerId];
  const trap = state.trapsById[command.payload.trapId];
  const source = state.districtsById[command.payload.sourceDistrictId];
  const target = state.districtsById[command.payload.targetDistrictId];
  const cooldown = state.cooldownStatesById[player.cooldownStateId]
    ?? createPlayerCooldownState(player.id, player.cooldownStateId);
  const cooldownTicks = Math.max(0, Number(context.config.balance.conflict?.trapRelocationCooldownTicks ?? 0));

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: { ...player, lastActionAt: command.issuedAt, version: player.version + 1 }
      },
      districtsById: {
        ...state.districtsById,
        [source.id]: bumpDistrictSecurityRevision({ ...source, version: source.version + 1 }),
        [target.id]: bumpDistrictSecurityRevision({ ...target, version: target.version + 1 })
      },
      trapsById: {
        ...state.trapsById,
        [trap.id]: { ...trap, districtId: target.id, version: trap.version + 1 }
      },
      cooldownStatesById: {
        ...state.cooldownStatesById,
        [cooldown.id]: {
          ...cooldown,
          cooldowns: {
            ...cooldown.cooldowns,
            [TRAP_RELOCATION_COOLDOWN_KEY]: state.root.tick + cooldownTicks
          },
          version: cooldown.version + (state.cooldownStatesById[cooldown.id] ? 1 : 0)
        }
      }
    },
    events: [createEvent(CORE_EVENT_TYPES.trapRelocated, {
      trapId: trap.id,
      playerId: player.id,
      sourceDistrictId: source.id,
      targetDistrictId: target.id
    })],
    errors: []
  };
};
