import { ATTACK_WEAPON_IDS, type AttackDistrictCommand, type AttackWeaponId } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import {
  calculateAttackPopulationRequired,
  calculateTotalAttackPower,
  normalizeAttackWeaponLoadout,
  resolveAttackWeaponInventory,
  validateMapAction
} from "../rules";
import { hasValidAttackAuthorization } from "./spyIntel";

/**
 * Responsibility: Placeholder validator for district attacks.
 * Belongs here: pure attack command precondition checks.
 * Does not belong here: transport auth or state mutation.
 */
export const validateAttack = (
  state: CoreGameState,
  command: AttackDistrictCommand,
  context?: GameCoreContext
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
      serverTime: command.issuedAt,
      expectedTargetVersion: command.payload.expectedTargetVersion,
      expectedOriginVersion: command.payload.expectedSourceVersion,
      routeDistrictId: command.payload.routeDistrictId,
      expectedRouteVersion: command.payload.expectedRouteVersion,
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

  const attackWeapons = context?.config.balance.attackWeapons;
  const selection = resolveAttackWeaponLoadout(state, attacker, command);
  if (selection.error) return [selection.error];
  if (!attackWeapons) {
    if (context) {
      return [{
        code: "attack_weapon_config_missing",
        message: "Konfigurace útočných zbraní není dostupná."
      }];
    }
    if (Object.values(selection.loadout).some((quantity) => Number(quantity) > 0)) {
      return [];
    }
    return [{
      code: "attack_empty_loadout",
      message: "Pro útok musíš vybrat alespoň jednu útočnou zbraň."
    }];
  }

  const sourceDistrict = command.payload.sourceDistrictId
    ? state.districtsById[command.payload.sourceDistrictId]
    : null;
  if (sourceDistrict && (sourceDistrict.stabilizingUntilTick ?? 0) > state.root.tick) {
    return [{ code: "SOURCE_DISTRICT_STABILIZING", message: "Stabilizující district nelze použít jako zdroj útoku." }];
  }
  if (calculateTotalAttackPower(selection.loadout, attackWeapons) <= 0) {
    return [
      {
        code: "attack_empty_loadout",
        message: "Pro útok musíš vybrat alespoň jednu útočnou zbraň."
      }
    ];
  }
  for (const weaponId of ATTACK_WEAPON_IDS) {
    if (Number(selection.loadout[weaponId] || 0) > Number(selection.inventory[weaponId] || 0)) {
      return [{ code: "attack_insufficient_weapon_inventory", message: "Nemáš dost kusů této zbraně." }];
    }
  }
  const availablePopulation = Math.max(0, Math.floor(Number(
    attacker.population ?? state.resourceStatesById[attacker.resourceStateId]?.balances?.population ?? 0
  )));
  const requiredPopulation = calculateAttackPopulationRequired(selection.loadout, attackWeapons);
  if (availablePopulation < requiredPopulation) {
    return [{ code: "attack_insufficient_population", message: "Nemáš dost obyvatel pro vybranou výzbroj." }];
  }

  const attackCooldownKey = `attack:${targetDistrict.id}`;
  const globalAttackCooldownKey = "attack:global";
  const sourceAttackCooldownKey = command.payload.sourceDistrictId
    ? `attack:source:${command.payload.sourceDistrictId}`
    : null;
  const cooldowns = state.cooldownStatesById[attacker.cooldownStateId]?.cooldowns ?? {};
  const activeAttackCooldownTick =
    cooldowns[globalAttackCooldownKey] ??
    (sourceAttackCooldownKey ? cooldowns[sourceAttackCooldownKey] : undefined) ??
    cooldowns[attackCooldownKey];

  if (typeof activeAttackCooldownTick === "number" && activeAttackCooldownTick > state.root.tick) {
    return [
      {
        code: "attack_cooldown_active",
        message: `Útočná trasa do ${targetDistrict.name} čeká ještě ${activeAttackCooldownTick - state.root.tick} ticků.`
      }
    ];
  }

  if (typeof targetDistrict.attackProtectedUntilTick === "number" && targetDistrict.attackProtectedUntilTick > state.root.tick) {
    return [{
      code: "attack_target_protected",
      message: `District ${targetDistrict.name} je chráněný ještě ${targetDistrict.attackProtectedUntilTick - state.root.tick} ticků.`
    }];
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

export const resolveAttackWeaponLoadout = (
  state: CoreGameState,
  player: NonNullable<CoreGameState["playersById"][string]>,
  command: AttackDistrictCommand
): {
  loadout: Partial<Record<AttackWeaponId, number>>;
  inventory: Partial<Record<AttackWeaponId, number>>;
  error: CoreError | null;
} => {
  const inventory = getAttackWeaponInventory(state, player);
  if (!command.payload.weapons) {
    return {
      loadout: {},
      inventory,
      error: {
        code: "attack_loadout_required",
        message: "Útok vyžaduje přesně vybranou výzbroj."
      }
    };
  }
  const normalized = normalizeAttackWeaponLoadout(command.payload.weapons);
  if (normalized.errorCode) {
    return {
      loadout: {},
      inventory,
      error: {
        code: normalized.errorCode,
        message: normalized.errorCode === "attack_unknown_weapon"
          ? "Tato zbraň není dostupná."
          : "Vybrané množství zbraně není platné."
      }
    };
  }
  return { loadout: normalized.loadout, inventory, error: null };
};

export const getAttackWeaponInventory = (
  state: CoreGameState,
  player: NonNullable<CoreGameState["playersById"][string]>
): Partial<Record<AttackWeaponId, number>> => {
  const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
  return resolveAttackWeaponInventory(balances, player.attackLoadout);
};
