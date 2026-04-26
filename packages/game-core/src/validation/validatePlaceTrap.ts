import type { PlaceTrapCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";

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

  if (district.status === "destroyed") {
    return [
      {
        code: "trap_district_destroyed",
        message: "Destroyed districts cannot be trapped."
      }
    ];
  }

  if (district.ownerPlayerId !== command.playerId) {
    return [
      {
        code: "trap_not_owned",
        message: "Player can only arm a trap on a district they own."
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
