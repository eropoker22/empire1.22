import type { CorePlayerCommand } from "../commands";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import {
  handleAcknowledgePendingRaid,
  handleActivatePlayerBoost,
  handleAllianceLifecycleCommand,
  handleAttackDistrict,
  handleBountyCommand,
  handleBuildStructure,
  handleCityEventCommand,
  handleCancelDrugLabProduction,
  handleCollectProduction,
  handleCraftItem,
  handleDrugLabProductionStart,
  handleClaimEmergencyRecovery,
  handleArmoryProductionStart,
  handleFactoryProductionStart,
  handleCancelArmoryProduction,
  handleCancelFactoryProduction,
  handleHeistDistrict,
  handleMarketCommand,
  handleCancelPharmacyProduction,
  handlePharmacyProductionStart,
  handleOccupyDistrict,
  handlePlaceDefense,
  handlePlaceTrap,
  handleRelocateTrap,
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
          code: player.status === "defeated" ? "PLAYER_DEFEATED" : "PLAYER_NOT_ACTIVE",
          message: player.status === "defeated"
            ? "Poražený hráč už nemůže provádět herní akce."
            : "Player is not active on this server.",
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
    case "activate-player-boost":
      return handleActivatePlayerBoost(state, command, context);
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
    case "start-city-event":
    case "claim-city-event-reward":
      return handleCityEventCommand(state, command, context);
    case "claim-emergency-recovery":
      return handleClaimEmergencyRecovery(state, command, context);
    case "create-bounty":
    case "cancel-bounty":
      return handleBountyCommand(state, command, context);
    case "collect-production":
      return handleCollectProduction(state, command, context);
    case "cancel-pharmacy-production":
      return handleCancelPharmacyProduction(state, command, context);
    case "cancel-drug-lab-production":
      return handleCancelDrugLabProduction(state, command, context);
    case "cancel-production-line":
      if (state.buildingsById[command.payload.buildingId]?.buildingTypeId === "factory") {
        return handleCancelFactoryProduction(state, command, context);
      }
      if (state.buildingsById[command.payload.buildingId]?.buildingTypeId === "armory") {
        return handleCancelArmoryProduction(state, command, context);
      }
      return {
        nextState: state,
        events: [],
        errors: [{ code: "production_line_not_found", message: "Cílová výrobní linka neexistuje." }]
      };
    case "craft-item":
      switch (state.buildingsById[command.payload.buildingId]?.buildingTypeId) {
        case "pharmacy":
          return handlePharmacyProductionStart(state, command, context);
        case "drug_lab":
          return handleDrugLabProductionStart(state, command, context);
        case "factory":
          return handleFactoryProductionStart(state, command, context);
        case "armory":
          return handleArmoryProductionStart(state, command, context);
        default:
          return handleCraftItem(state, command, context);
      }
    case "heist-district":
      return handleHeistDistrict(state, command, context);
    case "buy-market-resource":
    case "sell-market-resource":
    case "create-player-market-listing":
    case "buy-player-market-listing":
    case "cancel-player-market-listing":
      return handleMarketCommand(state, command, context);
    case "occupy-district":
      return handleOccupyDistrict(state, command, context);
    case "place-defense":
      return handlePlaceDefense(state, command, context);
    case "place-trap":
      return handlePlaceTrap(state, command, context);
    case "relocate-trap":
      return handleRelocateTrap(state, command, context);
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
