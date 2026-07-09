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
        message: "Cílová výrobní budova neexistuje."
      }
    ];
  }

  const district = state.districtsById[command.payload.districtId];

  if (!district || building.districtId !== district.id) {
    return [
      {
        code: "district_not_found",
        message: "Cílový district pro vybrání produkce neexistuje."
      }
    ];
  }

  if (district.ownerPlayerId !== command.playerId || building.ownerPlayerId !== command.playerId) {
    return [
      {
        code: "production_not_owned",
        message: "Hráč nevlastní cílovou výrobní budovu."
      }
    ];
  }

  if (building.status !== "active") {
    return [
      {
        code: "building_not_active",
        message: "Produkci jde vybrat jen z aktivních výrobních budov."
      }
    ];
  }

  const productionProfile = context.config.balance.productionBuildings?.[building.buildingTypeId];

  if (!productionProfile) {
    return [
      {
        code: "production_not_supported",
        message: "Cílová budova nepodporuje serverové vybrání produkce."
      }
    ];
  }

  const resourceState = state.resourceStatesById[composeEntityId("resource", building.id)];
  const readyAmount = Math.max(0, Number(resourceState?.balances?.[productionProfile.resourceKey] || 0));

  if (readyAmount <= 0) {
    return [
      {
        code: "production_empty",
        message: `${productionProfile.resourceLabel} ještě není připravený k vybrání.`
      }
    ];
  }

  return [];
};
