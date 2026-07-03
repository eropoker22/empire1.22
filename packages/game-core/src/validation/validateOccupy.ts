import type { OccupyDistrictCommand } from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import {
  createOccupyCooldownKey,
  detectAlliedEncirclementAfterOccupy,
  resolveOccupyBalance,
  resolveOccupyPopulationCost,
  validateMapAction
} from "../rules";
import { validateOccupyEmptyDistrictAuthorization } from "./spyIntel";

/**
 * Responsibility: Pure validator for neutral district occupation after successful intel.
 * Belongs here: player, adjacency, neutral ownership, and spy-intel preconditions.
 * Does not belong here: capture state mutation, combat, or UI shaping.
 */
export const validateOccupy = (
  state: CoreGameState,
  command: OccupyDistrictCommand,
  conflictConfig?: ConflictBalanceConfig
): CoreError[] => {
  const player = state.playersById[command.playerId];
  const targetDistrict = state.districtsById[command.payload.districtId];

  if (!player) {
    return [
      {
        code: "occupy_player_not_found",
        message: `Player ${command.playerId} was not found.`
      }
    ];
  }

  if (!targetDistrict) {
    return [
      {
        code: "occupy_target_not_found",
        message: `Target district ${command.payload.districtId} was not found.`
      }
    ];
  }

  const mapValidation = validateMapAction(state, {
    actorPlayerId: command.playerId,
    targetDistrictId: command.payload.districtId,
    originDistrictId: command.payload.sourceDistrictId ?? undefined,
    action: "occupy"
  }, {
    hasOccupyAuthorization: () =>
      validateOccupyEmptyDistrictAuthorization(state, command.playerId, command.payload.districtId),
    detectConsentRequired: () =>
      detectAlliedEncirclementAfterOccupy(state, command.playerId, command.payload.districtId)
  });

  if (!mapValidation.allowed) {
    return [
      {
        code: mapValidation.reasonCode ?? "occupy_not_allowed",
        message: occupyMapActionErrorMessage(mapValidation.reasonCode)
      }
    ];
  }

  const balance = resolveOccupyBalance(conflictConfig);
  const populationCost = resolveOccupyPopulationCost(state, player.id);
  const sourceDistrict = mapValidation.originDistrictId
    ? state.districtsById[mapValidation.originDistrictId]
    : null;
  const occupyCooldownKey = createOccupyCooldownKey(targetDistrict.id);
  const activeOccupyCooldownTick =
    state.cooldownStatesById[player.cooldownStateId]?.cooldowns?.[occupyCooldownKey];

  if (typeof activeOccupyCooldownTick === "number" && activeOccupyCooldownTick > state.root.tick) {
    return [
      {
        code: "occupy_on_cooldown",
        message: `Occupation route to ${targetDistrict.name} is cooling down for ${activeOccupyCooldownTick - state.root.tick} more ticks.`
      }
    ];
  }

  if (!sourceDistrict) {
    return [
      {
        code: "NO_VALID_ORIGIN",
        message: "Player must occupy from one owned neighboring district."
      }
    ];
  }

  if (Math.max(0, Number(sourceDistrict.influence || 0)) < balance.influenceCost) {
    return [
      {
        code: "occupy_not_enough_influence",
        message: `Occupation requires ${balance.influenceCost} influence in the source district.`
      }
    ];
  }

  const availablePopulation = Math.max(
    0,
    Math.floor(Number(
      player.population ??
        state.resourceStatesById[player.resourceStateId]?.balances?.population ??
        0
    ))
  );

  if (availablePopulation < populationCost) {
    return [
      {
        code: "occupy_not_enough_population",
        message: `Occupation requires ${populationCost} population.`
      }
    ];
  }

  return [];
};

const occupyMapActionErrorMessage = (reasonCode: string | undefined): string => {
  switch (reasonCode) {
    case "TARGET_IS_SELF":
      return "Player already controls this district.";
    case "TARGET_IS_ALLY":
    case "TARGET_NOT_EMPTY":
      return "Only empty neighboring districts can be occupied.";
    case "NO_VALID_ORIGIN":
      return "Player must occupy from one owned neighboring district.";
    case "TARGET_NOT_ADJACENT":
      return "Player can only occupy a district that borders the selected source district.";
    case "DISTRICT_LOCKED":
      return "Locked or destroyed districts cannot be occupied.";
    case "OCCUPY_SPY_REQUIRED":
      return "Successful spy authorization is required before occupying this district.";
    case "OCCUPY_SPY_AUTH_EXPIRED":
      return "Spy authorization for this district has expired.";
    case "OCCUPY_SPY_AUTH_INVALIDATED":
    case "OCCUPY_TARGET_CHANGED":
      return "Spy authorization no longer matches the target district state.";
    case "CONSENT_REQUIRED":
      return "Occupying this district would close an ally's last empty frontier and requires consent.";
    default:
      return "Occupation is not allowed for this district.";
  }
};
