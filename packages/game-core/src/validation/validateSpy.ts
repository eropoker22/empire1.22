import type { SpyDistrictCommand } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";

/**
 * Responsibility: Pure validator for district spy commands.
 * Belongs here: precondition checks for authoritative spy actions.
 * Does not belong here: spy outcome calculation or projection shaping.
 */
export const validateSpy = (
  state: CoreGameState,
  command: SpyDistrictCommand
): CoreError[] => {
  const player = state.playersById[command.playerId];
  const sourceDistrict = state.districtsById[command.payload.sourceDistrictId];
  const targetDistrict = state.districtsById[command.payload.districtId];

  if (!player) {
    return [
      {
        code: "spy_player_not_found",
        message: `Player ${command.playerId} was not found.`
      }
    ];
  }

  if (!targetDistrict) {
    return [
      {
        code: "spy_target_not_found",
        message: `Target district ${command.payload.districtId} was not found.`
      }
    ];
  }

  if (!sourceDistrict) {
    return [
      {
        code: "spy_source_not_found",
        message: "Player must spy from one owned neighboring district."
      }
    ];
  }

  if (sourceDistrict.status === "destroyed") {
    return [
      {
        code: "spy_source_destroyed",
        message: "Player cannot spy from a destroyed district."
      }
    ];
  }

  if (targetDistrict.status === "destroyed") {
    return [
      {
        code: "spy_target_destroyed",
        message: "Destroyed districts cannot be spied on."
      }
    ];
  }

  if (sourceDistrict.ownerPlayerId !== command.playerId) {
    return [
      {
        code: "spy_source_not_owned",
        message: "Player can only spy from a district they own."
      }
    ];
  }

  if (targetDistrict.ownerPlayerId === command.playerId) {
    return [
      {
        code: "spy_own_district",
        message: "Player cannot spy on a district they already own."
      }
    ];
  }

  if (!sourceDistrict.adjacentDistrictIds.includes(targetDistrict.id)) {
    return [
      {
        code: "spy_target_not_adjacent",
        message: "Player can only spy on a district that borders the selected source district."
      }
    ];
  }

  const spyCooldownKey = `spy:${targetDistrict.id}`;
  const activeSpyCooldownTick = state.cooldownStatesById[player.cooldownStateId]?.cooldowns?.[spyCooldownKey];

  if (typeof activeSpyCooldownTick === "number" && activeSpyCooldownTick > state.root.tick) {
    return [
      {
        code: "spy_cooldown_active",
        message: `Spy route to ${targetDistrict.name} is cooling down for ${activeSpyCooldownTick - state.root.tick} more ticks.`
      }
    ];
  }

  return [];
};
