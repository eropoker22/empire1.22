import type { SpyDistrictCommand } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import { validateMapAction } from "../rules";

export const MAX_ACTIVE_SPY_SLOTS = 2;
export const SPY_BLOCKED_SLOT_COOLDOWN_PREFIX = "spy-blocked-slot:";

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

  const mapValidation = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.districtId,
    originDistrictId: command.payload.sourceDistrictId,
    action: "spy"
  });

  if (!mapValidation.allowed) {
    return [
      {
        code: mapValidation.reasonCode ?? "spy_not_allowed",
        message: spyMapActionErrorMessage(mapValidation.reasonCode)
      }
    ];
  }

  const activeSpySlotCount = countActiveSpySlots(state, player.cooldownStateId);
  if (activeSpySlotCount >= MAX_ACTIVE_SPY_SLOTS) {
    return [
      {
        code: "spy_capacity_exceeded",
        message: `Player already has ${MAX_ACTIVE_SPY_SLOTS} active or blocked spies.`
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

const spyMapActionErrorMessage = (reasonCode: string | undefined): string => {
  switch (reasonCode) {
    case "SPY_TARGET_IS_SELF":
      return "Player cannot spy on a district they already own.";
    case "SPY_TARGET_IS_ALLY":
      return "Player cannot spy on an allied district.";
    case "SPY_TARGET_INVALID":
      return "Player can only spy on empty or enemy-owned districts.";
    case "NO_VALID_ORIGIN":
      return "Player must spy from one owned neighboring district.";
    case "SPY_TARGET_NOT_ADJACENT":
      return "Player can only spy on a district that borders the selected source district.";
    case "DISTRICT_LOCKED":
      return "Locked or destroyed districts cannot be spied on.";
    default:
      return "Spy action is not allowed for this district.";
  }
};

export const countActiveSpySlots = (
  state: CoreGameState,
  cooldownStateId: string
): number => {
  const cooldowns = state.cooldownStatesById[cooldownStateId]?.cooldowns ?? {};
  return Object.entries(cooldowns).filter(([key, expiresAtTick]) =>
    key.startsWith(SPY_BLOCKED_SLOT_COOLDOWN_PREFIX)
    && typeof expiresAtTick === "number"
    && expiresAtTick > state.root.tick
  ).length;
};
