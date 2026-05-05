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
  handlePlaceTrap,
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
    case "place-trap":
      return handlePlaceTrap(state, command, context);
    case "run-building-action":
      return handleUseBuildingAction(state, command, context);
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
