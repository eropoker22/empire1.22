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
        message: `Hráč ${command.playerId} nebyl nalezen.`
      }
    ];
  }

  if (!district) {
    return [
      {
        code: "trap_district_not_found",
        message: `Cílový district ${command.payload.districtId} nebyl nalezen.`
      }
    ];
  }

  const mapValidation = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.districtId,
    serverTime: command.issuedAt,
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
        message: `Past už je v districtu ${district.name} nastražená.`
      }
    ];
  }

  if (activeTrap) {
    return [
      {
        code: "trap_limit_reached",
        message: "Hráč může mít najednou nastraženou jen jednu aktivní past."
      }
    ];
  }

  return [];
};

const trapMapActionErrorMessage = (reasonCode: string | undefined): string => {
  switch (reasonCode) {
    case "TRAP_TARGET_NOT_OWNED":
      return "Past můžeš nastražit jen ve vlastním districtu.";
    case "DISTRICT_LOCKED":
      return "Zamčené nebo zničené districty nejde zapastit.";
    default:
      return "V tomhle districtu nejde past nastražit.";
  }
};
