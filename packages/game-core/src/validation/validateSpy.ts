import type { SpyDistrictCommand } from "@empire/shared-types";
import type { PlayerSpyOperationSlot, PlayerSpyOperationState } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import { resolveDistrictActionAvailability, validateMapAction } from "../rules";
import { createPlayerSpyOperationState } from "../state";
import { hasValidAttackAuthorization, validateOccupyEmptyDistrictAuthorization } from "./spyIntel";

export const MAX_ACTIVE_SPY_SLOTS = 2;

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
        message: `Hráč ${command.playerId} nebyl nalezen.`
      }
    ];
  }

  if (!targetDistrict) {
    return [
      {
        code: "spy_target_not_found",
        message: `Cílový district ${command.payload.districtId} nebyl nalezen.`
      }
    ];
  }

  const availabilityError = resolveDistrictActionAvailability(state, command.playerId, targetDistrict.id, "spy");
  if (availabilityError) return [availabilityError];
  const activeIntel = targetDistrict.ownerPlayerId
    ? hasValidAttackAuthorization(state, command.playerId, targetDistrict.id)
    : validateOccupyEmptyDistrictAuthorization(state, command.playerId, targetDistrict.id) === true;
  if (activeIntel) {
    return [{
      code: "SPY_INTEL_ALREADY_ACTIVE",
      message: "Na tento district už máš stále platné informace."
    }];
  }

  const mapValidation = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.districtId,
    originDistrictId: command.payload.sourceDistrictId,
    routeDistrictId: command.payload.routeDistrictId,
    expectedRouteVersion: command.payload.expectedRouteVersion,
    serverTime: command.issuedAt,
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

  if (!resolveAvailableSpySlot(state, player.id)) {
    return [
      {
        code: "SPY_SLOT_LIMIT_REACHED",
        message: `Hráč už má ${MAX_ACTIVE_SPY_SLOTS} aktivní nebo blokované špehy.`
      }
    ];
  }

  const spyCooldownKey = `spy:${targetDistrict.id}`;
  const activeSpyCooldownTick = state.cooldownStatesById[player.cooldownStateId]?.cooldowns?.[spyCooldownKey];

  if (typeof activeSpyCooldownTick === "number" && activeSpyCooldownTick > state.root.tick) {
    return [
      {
        code: "spy_cooldown_active",
        message: `Špionáž do ${targetDistrict.name} čeká ještě ${activeSpyCooldownTick - state.root.tick} ticků.`
      }
    ];
  }

  return [];
};

const spyMapActionErrorMessage = (reasonCode: string | undefined): string => {
  switch (reasonCode) {
    case "SPY_TARGET_IS_SELF":
      return "Nemůžeš špehovat district, který už vlastníš.";
    case "SPY_TARGET_IS_ALLY":
      return "Nemůžeš špehovat spojenecký district.";
    case "SPY_TARGET_INVALID":
      return "Špehovat můžeš jen prázdné nebo nepřátelské districty.";
    case "NO_VALID_ORIGIN":
      return "Špionáž musí vycházet z jednoho vlastního sousedního districtu.";
    case "SPY_TARGET_NOT_ADJACENT":
      return "Špehovat můžeš jen district, který sousedí s vybraným zdrojovým districtem.";
    case "DISTRICT_LOCKED":
      return "Zamčené nebo zničené districty nejde špehovat.";
    default:
      return "V tomhle districtu nejde špionáž spustit.";
  }
};

export const countActiveSpySlots = (
  state: CoreGameState,
  playerId: string
): number => getPlayerSpyOperationState(state, playerId).slots.filter(
  (slot) => slot.availableAtTick > state.root.tick
).length;

export const getPlayerSpyOperationState = (
  state: CoreGameState,
  playerId: string
): PlayerSpyOperationState =>
  state.playerSpyOperationStatesByPlayerId?.[playerId] ?? createPlayerSpyOperationState(playerId);

export const resolveAvailableSpySlot = (
  state: CoreGameState,
  playerId: string
): PlayerSpyOperationSlot | null =>
  [...getPlayerSpyOperationState(state, playerId).slots]
    .sort((left, right) => left.slotId.localeCompare(right.slotId))
    .find((slot) => slot.availableAtTick <= state.root.tick) ?? null;
