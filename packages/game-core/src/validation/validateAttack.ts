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
        message: `Útočící hráč ${command.playerId} nebyl nalezen.`
      }
    ];
  }

  if (!targetDistrict) {
    return [
      {
        code: "district_not_found",
        message: `Cílový district ${command.payload.districtId} nebyl nalezen.`
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
        message: "Hráč nemá pro tenhle útok dostupné žádné útočné zbraně."
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
        message: `Útočná trasa do ${targetDistrict.name} čeká ještě ${activeAttackCooldownTick - state.root.tick} ticků.`
      }
    ];
  }

  return [];
};

const mapActionErrorMessage = (reasonCode: string | undefined): string => {
  switch (reasonCode) {
    case "TARGET_IS_SELF":
      return "Nemůžeš útočit na district, který už vlastníš.";
    case "TARGET_IS_ALLY":
      return "Nemůžeš útočit na spojenecký district.";
    case "TARGET_NOT_ENEMY":
      return "Útočit můžeš jen na nepřátelský district.";
    case "NO_VALID_ORIGIN":
      return "Útok musí vycházet z jednoho vlastního sousedního districtu.";
    case "TARGET_NOT_ADJACENT":
      return "Útočit můžeš jen na district, který sousedí s vybraným zdrojovým districtem.";
    case "SPY_REQUIRED":
      return "Před útokem na tenhle district potřebuješ platné úspěšné špehování.";
    case "DISTRICT_LOCKED":
      return "Zamčené nebo zničené districty nejde napadnout.";
    default:
      return "V tomhle districtu nejde útok spustit.";
  }
};
