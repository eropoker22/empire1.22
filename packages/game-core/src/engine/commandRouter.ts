import type { CorePlayerCommand } from "../commands";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import {
  handleAcknowledgePendingRaid,
  handleAllianceLifecycleCommand,
  handleAttackDistrict,
  handleBountyCommand,
  handleBuildStructure,
  handleCollectProduction,
  handleCraftItem,
  handleHeistDistrict,
  handleMarketCommand,
  handleCancelPharmacyProduction,
  handlePharmacyProductionStart,
  handleOccupyDistrict,
  handlePlaceDefense,
  handlePlaceTrap,
  handleRemoveDefense,
  handleRobDistrict,
  handleSelectSpawnDistrict,
  handleSpyDistrict,
  handleUpgradeBuilding,
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
    case "create-alliance":
    case "join-alliance":
    case "invite-alliance-member":
    case "respond-alliance-invite":
    case "send-alliance-chat-message":
    case "send-public-alliance-message":
    case "send-public-alliance-invite":
    case "confirm-alliance-ready":
    case "start-alliance-kick-vote":
    case "cast-alliance-kick-vote":
    case "leave-alliance":
    case "disband-alliance":
      return handleAllianceLifecycleCommand(state, command, context);
    case "attack-district":
      return handleAttackDistrict(state, command, context);
    case "build-structure":
      // Deprecated dev-only compatibility path. Main gameplay uses fixed district.buildingIds.
      return handleBuildStructure(state, command, context);
    case "create-bounty":
    case "cancel-bounty":
      return handleBountyCommand(state, command, context);
    case "collect-production":
      return handleCollectProduction(state, command, context);
    case "cancel-pharmacy-production":
      return handleCancelPharmacyProduction(state, command, context);
    case "craft-item":
      return state.buildingsById[command.payload.buildingId]?.buildingTypeId === "pharmacy"
        ? handlePharmacyProductionStart(state, command, context)
        : handleCraftItem(state, command, context);
    case "heist-district":
      return handleHeistDistrict(state, command, context);
    case "buy-market-resource":
    case "sell-market-resource":
      return handleMarketCommand(state, command, context);
    case "occupy-district":
      return handleOccupyDistrict(state, command, context);
    case "place-defense":
      return handlePlaceDefense(state, command, context);
    case "place-trap":
      return handlePlaceTrap(state, command, context);
    case "remove-defense":
      return handleRemoveDefense(state, command, context);
    case "rob-district":
      return handleRobDistrict(state, command, context);
    case "run-building-action":
      return handleUseBuildingAction(state, command, context);
    case "select-spawn-district":
      return handleSelectSpawnDistrict(state, command, context);
    case "spy-district":
      return handleSpyDistrict(state, command, context);
    case "upgrade-building":
      return handleUpgradeBuilding(state, command, context);
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
