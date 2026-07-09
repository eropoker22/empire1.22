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
        message: `Hráč ${command.playerId} nebyl nalezen.`
      }
    ];
  }

  if (!targetDistrict) {
    return [
      {
        code: "occupy_target_not_found",
        message: `Cílový district ${command.payload.districtId} nebyl nalezen.`
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
        message: `Trasa obsazení do ${targetDistrict.name} čeká ještě ${activeOccupyCooldownTick - state.root.tick} ticků.`
      }
    ];
  }

  if (!sourceDistrict) {
    return [
      {
        code: "NO_VALID_ORIGIN",
        message: "Obsazení musí vycházet z jednoho vlastního sousedního districtu."
      }
    ];
  }

  if (Math.max(0, Number(sourceDistrict.influence || 0)) < balance.influenceCost) {
    return [
      {
        code: "occupy_not_enough_influence",
        message: `Obsazení vyžaduje ${balance.influenceCost} vlivu ve zdrojovém districtu.`
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
        message: `Obsazení vyžaduje ${populationCost} populace.`
      }
    ];
  }

  return [];
};

const occupyMapActionErrorMessage = (reasonCode: string | undefined): string => {
  switch (reasonCode) {
    case "TARGET_IS_SELF":
      return "Tenhle district už kontroluješ.";
    case "TARGET_IS_ALLY":
    case "TARGET_NOT_EMPTY":
      return "Obsadit můžeš jen prázdné sousední districty.";
    case "NO_VALID_ORIGIN":
      return "Obsazení musí vycházet z jednoho vlastního sousedního districtu.";
    case "TARGET_NOT_ADJACENT":
      return "Obsadit můžeš jen district, který sousedí s vybraným zdrojovým districtem.";
    case "DISTRICT_LOCKED":
      return "Zamčené nebo zničené districty nejde obsadit.";
    case "OCCUPY_SPY_REQUIRED":
      return "Před obsazením tenhle district musíš úspěšně vyšpehovat.";
    case "OCCUPY_SPY_AUTH_EXPIRED":
      return "Špionážní oprávnění pro tenhle district vypršelo.";
    case "OCCUPY_SPY_AUTH_INVALIDATED":
    case "OCCUPY_TARGET_CHANGED":
      return "Špionážní oprávnění už neodpovídá aktuálnímu stavu districtu.";
    case "DOWNTOWN_LOCKED_UNTIL_FINAL_LOCKDOWN":
      return "Downtown districty jde obsadit až během final lockdownu.";
    case "CONSENT_REQUIRED":
      return "Obsazení by spojenci zavřelo poslední prázdnou hranici a vyžaduje souhlas.";
    default:
      return "V tomhle districtu nejde obsazení spustit.";
  }
};
