import type { BuildStructureCommand } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";

/**
 * Responsibility: Deprecated validator for dev-only build-structure commands.
 * Belongs here: pure checks over command shape and state availability.
 * Does not belong here: cost resolution or UI form validation.
 *
 * @deprecated Main gameplay does not expose construction; fixed buildings come from district.buildingIds.
 */
export const validateBuildStructure = (
  state: CoreGameState,
  command: BuildStructureCommand,
  context: GameCoreContext
): CoreError[] => {
  const district = state.districtsById[command.payload.districtId];

  if (!district) {
    return [
      {
        code: "district_not_found",
        message: "Target district does not exist."
      }
    ];
  }

  if (district.ownerPlayerId !== command.playerId) {
    return [
      {
        code: "district_not_owned",
        message: "Player does not own the target district."
      }
    ];
  }

  if (command.payload.slotIndex < 0 || command.payload.slotIndex >= district.slotCount) {
    return [
      {
        code: "invalid_slot_index",
        message: "Requested build slot is outside the district capacity."
      }
    ];
  }

  if (district.buildingIds.length >= district.slotCount) {
    return [
      {
        code: "district_full",
        message: "No free building slot remains in the target district."
      }
    ];
  }

  if (district.slotCount > context.config.balance.buildSlotLimit) {
    return [
      {
        code: "district_slot_limit_exceeds_mode_cap",
        message: "District slot count exceeds the resolved mode configuration."
      }
    ];
  }

  return [];
};
