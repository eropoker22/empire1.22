import type { CollectProductionCommand } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { composeEntityId } from "../utils";

/**
 * Responsibility: Placeholder validator for production collection.
 * Belongs here: pure collect command precondition checks.
 * Does not belong here: transport concerns.
 */
export const validateCollect = (
  state: CoreGameState,
  command: CollectProductionCommand,
  context: GameCoreContext
): CoreError[] => {
  const building = state.buildingsById[command.payload.buildingId];

  if (!building) {
    return [
      {
        code: "building_not_found",
        message: "Target production building does not exist."
      }
    ];
  }

  const district = state.districtsById[command.payload.districtId];

  if (!district || building.districtId !== district.id) {
    return [
      {
        code: "district_not_found",
        message: "Target district for collection does not exist."
      }
    ];
  }

  if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) {
    return [
      {
        code: "production_not_owned",
        message: "Player does not own the target production building."
      }
    ];
  }

  if (building.status !== "active") {
    return [
      {
        code: "building_not_active",
        message: "Only active production buildings can be collected."
      }
    ];
  }

  const productionProfile = context.config.balance.productionBuildings?.[building.buildingTypeId];

  if (!productionProfile) {
    return [
      {
        code: "production_not_supported",
        message: "The target building does not support migrated production collection."
      }
    ];
  }

  const resourceState = state.resourceStatesById[composeEntityId("resource", building.id)];
  const readyAmount = Math.max(0, Number(resourceState?.balances?.[productionProfile.resourceKey] || 0));

  if (readyAmount <= 0) {
    return [
      {
        code: "production_empty",
        message: `No ${productionProfile.resourceLabel} is ready to collect.`
      }
    ];
  }

  return [];
};
