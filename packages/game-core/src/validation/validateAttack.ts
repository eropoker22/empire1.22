import type { AttackDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import { calculateTotalAttackPower } from "../rules";

/**
 * Responsibility: Placeholder validator for district attacks.
 * Belongs here: pure attack command precondition checks.
 * Does not belong here: transport auth or state mutation.
 */
export const validateAttack = (
  state: CoreGameState,
  command: AttackDistrictCommand
): CoreError[] => {
  const attacker = state.playersById[command.playerId];
  const sourceDistrict = command.payload.sourceDistrictId
    ? state.districtsById[command.payload.sourceDistrictId]
    : null;
  const targetDistrict = state.districtsById[command.payload.districtId];

  if (!attacker) {
    return [
      {
        code: "attacker_not_found",
        message: `Attacking player ${command.playerId} was not found.`
      }
    ];
  }

  if (!targetDistrict) {
    return [
      {
        code: "district_not_found",
        message: `Target district ${command.payload.districtId} was not found.`
      }
    ];
  }

  if (!sourceDistrict) {
    return [
      {
        code: "source_district_not_found",
        message: "Player must attack from one owned neighboring district."
      }
    ];
  }

  if (sourceDistrict.status === "destroyed") {
    return [
      {
        code: "source_district_destroyed",
        message: "Player cannot attack from a destroyed district."
      }
    ];
  }

  if (targetDistrict.status === "destroyed") {
    return [
      {
        code: "target_district_destroyed",
        message: "Destroyed districts cannot be attacked."
      }
    ];
  }

  if (sourceDistrict.ownerPlayerId !== command.playerId) {
    return [
      {
        code: "source_district_not_owned",
        message: "Player can only attack from a district they own."
      }
    ];
  }

  if (targetDistrict.ownerPlayerId === command.playerId) {
    return [
      {
        code: "attack_own_district",
        message: "Player cannot attack a district they already own."
      }
    ];
  }

  if (!sourceDistrict.adjacentDistrictIds.includes(targetDistrict.id)) {
    return [
      {
        code: "target_not_adjacent",
        message: "Player can only attack a district that borders the selected source district."
      }
    ];
  }

  if (calculateTotalAttackPower(attacker.attackLoadout) <= 0) {
    return [
      {
        code: "no_attack_weapons",
        message: "Player has no attack weapons available for this attack."
      }
    ];
  }

  const attackCooldownKey = `attack:${targetDistrict.id}`;
  const activeAttackCooldownTick =
    state.cooldownStatesById[attacker.cooldownStateId]?.cooldowns?.[attackCooldownKey];

  if (typeof activeAttackCooldownTick === "number" && activeAttackCooldownTick > state.root.tick) {
    return [
      {
        code: "attack_cooldown_active",
        message: `Attack route to ${targetDistrict.name} is cooling down for ${activeAttackCooldownTick - state.root.tick} more ticks.`
      }
    ];
  }

  return [];
};
