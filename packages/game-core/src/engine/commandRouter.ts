import type { CorePlayerCommand } from "../commands";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import {
  handleAcknowledgePendingRaid,
  handleAttackDistrict,
  handleBuildStructure,
  handleCollectProduction,
  handleCraftItem,
  handleOccupyDistrict,
  handlePlaceTrap,
  handleSelectSpawnDistrict,
  handleSpyDistrict,
  handleUseBuildingAction
} from "../handlers";
import type { GameCoreContext } from "./context";

/**
 * Responsibility: Routes commands to dedicated handlers without leaking transport concerns.
 * Belongs here: discriminated command dispatch inside the core boundary.
 * Does not belong here: mode branching, HTTP mapping, or logging side effects.
 */
export const routeCommand = (
  state: CoreGameState,
  command: CorePlayerCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const player = state.playersById[command.playerId];
  if (player && player.status !== "active") {
    return {
      nextState: state,
      events: [],
      errors: [
        {
          code: "player_not_active",
          message: "Player is not active on this server.",
          details: {
            playerId: player.id,
            status: player.status
          }
        }
      ]
    };
  }

  if (player && command.type !== "select-spawn-district" && !player.homeDistrictId) {
    return {
      nextState: state,
      events: [],
      errors: [
        {
          code: "AWAITING_SPAWN_SELECTION",
          message: "Player must select a start district before gameplay actions are available.",
          details: {
            playerId: player.id
          }
        }
      ]
    };
  }

  switch (command.type) {
    case "acknowledge-pending-raid":
      return handleAcknowledgePendingRaid(state, command, context);
    case "attack-district":
      return handleAttackDistrict(state, command, context);
    case "build-structure":
      // Deprecated dev-only compatibility path. Main gameplay uses fixed district.buildingIds.
      return handleBuildStructure(state, command, context);
    case "collect-production":
      return handleCollectProduction(state, command, context);
    case "craft-item":
      return handleCraftItem(state, command, context);
    case "occupy-district":
      return handleOccupyDistrict(state, command, context);
    case "place-trap":
      return handlePlaceTrap(state, command, context);
    case "run-building-action":
      return handleUseBuildingAction(state, command, context);
    case "select-spawn-district":
      return handleSelectSpawnDistrict(state, command, context);
    case "spy-district":
      return handleSpyDistrict(state, command, context);
    default:
      return {
        nextState: state,
        events: [],
        errors: [
          {
            code: "unsupported_command",
            message: "Unsupported command type."
          }
        ]
      };
  }
};
