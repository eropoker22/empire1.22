import type { PlaceTrapCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import { validateMapAction } from "../rules";

/**
 * Responsibility: Pure validator for district trap placement commands.
 * Belongs here: hidden-state precondition checks for trap arming.
 * Does not belong here: trap trigger resolution or transport concerns.
 */
export const validatePlaceTrap = (
  state: CoreGameState,
  command: PlaceTrapCommand
): CoreError[] => {
  const player = state.playersById[command.playerId];
  const district = state.districtsById[command.payload.districtId];

  if (!player) {
    return [
      {
        code: "trap_player_not_found",
        message: `Player ${command.playerId} was not found.`
      }
    ];
  }

  if (!district) {
    return [
      {
        code: "trap_district_not_found",
        message: `Target district ${command.payload.districtId} was not found.`
      }
    ];
  }

  const mapValidation = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.districtId,
    action: "place_trap"
  });

  if (!mapValidation.allowed) {
    return [
      {
        code: mapValidation.reasonCode ?? "trap_not_allowed",
        message: trapMapActionErrorMessage(mapValidation.reasonCode)
      }
    ];
  }

  const activeTrap = Object.values(state.trapsById).find(
    (trap) => trap.ownerPlayerId === command.playerId && trap.status === "active"
  );

  if (activeTrap?.districtId === district.id) {
    return [
      {
        code: "trap_already_active",
        message: `A trap is already armed on ${district.name}.`
      }
    ];
  }

  if (activeTrap) {
    return [
      {
        code: "trap_limit_reached",
        message: "Player can only keep one active trap armed at a time."
      }
    ];
  }

  return [];
};

const trapMapActionErrorMessage = (reasonCode: string | undefined): string => {
  switch (reasonCode) {
    case "TRAP_TARGET_NOT_OWNED":
      return "Player can only arm a trap on a district they own.";
    case "DISTRICT_LOCKED":
      return "Locked or destroyed districts cannot be trapped.";
    default:
      return "Trap placement is not allowed for this district.";
  }
};
