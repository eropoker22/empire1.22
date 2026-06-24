import type { AttackDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import { calculateTotalAttackPower, validateMapAction } from "../rules";
import { hasValidAttackAuthorization } from "./spyIntel";

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

  const mapValidation = validateMapAction(
    state,
    {
      actorPlayerId: command.playerId,
      targetDistrictId: command.payload.districtId,
      originDistrictId: command.payload.sourceDistrictId ?? undefined,
      action: "attack"
    },
    {
      hasAttackAuthorization: () =>
        hasValidAttackAuthorization(state, command.playerId, command.payload.districtId)
    }
  );

  if (!mapValidation.allowed) {
    return [
      {
        code: mapValidation.reasonCode ?? "attack_not_allowed",
        message: mapActionErrorMessage(mapValidation.reasonCode)
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

const mapActionErrorMessage = (reasonCode: string | undefined): string => {
  switch (reasonCode) {
    case "TARGET_IS_SELF":
      return "Player cannot attack a district they already own.";
    case "TARGET_IS_ALLY":
      return "Player cannot attack an allied district.";
    case "TARGET_NOT_ENEMY":
      return "Player can only attack an enemy-owned district.";
    case "NO_VALID_ORIGIN":
      return "Player must attack from one owned neighboring district.";
    case "TARGET_NOT_ADJACENT":
      return "Player can only attack a district that borders the selected source district.";
    case "SPY_REQUIRED":
      return "A valid successful spy authorization is required before attacking this district.";
    case "DISTRICT_LOCKED":
      return "Locked or destroyed districts cannot be attacked.";
    default:
      return "Attack is not allowed for this district.";
  }
};
