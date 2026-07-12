import { ATTACK_WEAPON_IDS, type AttackWeaponId } from "@empire/shared-types";
import type { AttackWeaponsBalanceConfig } from "../../contracts";

export const validateAttackWeaponsConfig = (config: AttackWeaponsBalanceConfig): void => {
  for (const weaponId of Object.keys(config)) {
    if (!ATTACK_WEAPON_IDS.includes(weaponId as AttackWeaponId)) {
      throw new Error("Attack weapon config contains an unknown weapon " + weaponId + ".");
    }
  }
  for (const weaponId of ATTACK_WEAPON_IDS) {
    const weapon = config[weaponId];
    if (!weapon?.label || !weapon?.description) {
      throw new Error("Attack weapon config requires a label and description for " + weaponId + ".");
    }
    for (const value of [weapon.baseAttackPower, weapon.populationRequired]) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("Attack weapon config requires positive integer power and population.");
      }
    }
  }
};

export const normalizeAttackWeaponLoadout = (
  weapons: unknown
): { loadout: Partial<Record<AttackWeaponId, number>>; errorCode: string | null } => {
  if (!weapons || typeof weapons !== "object" || Array.isArray(weapons)) {
    return { loadout: {}, errorCode: "attack_invalid_weapon_quantity" };
  }
  const loadout: Partial<Record<AttackWeaponId, number>> = {};
  for (const [weaponId, quantity] of Object.entries(weapons as Record<string, unknown>)) {
    if (!ATTACK_WEAPON_IDS.includes(weaponId as AttackWeaponId)) {
      return { loadout: {}, errorCode: "attack_unknown_weapon" };
    }
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
      return { loadout: {}, errorCode: "attack_invalid_weapon_quantity" };
    }
    if (Number(quantity) > 0) loadout[weaponId as AttackWeaponId] = Number(quantity);
  }
  return { loadout, errorCode: null };
};

export const calculateAttackWeaponPower = (
  loadout: Partial<Record<AttackWeaponId, number>>,
  config: AttackWeaponsBalanceConfig,
  modifiers: Partial<Record<AttackWeaponId, number>> = {}
): number => ATTACK_WEAPON_IDS.reduce((total, weaponId) => {
  const quantity = Math.max(0, Number(loadout[weaponId] || 0));
  const multiplier = Math.max(0, Number(modifiers[weaponId] ?? 1));
  return total + quantity * config[weaponId].baseAttackPower * multiplier;
}, 0);

export const calculateAttackPopulationRequired = (
  loadout: Partial<Record<AttackWeaponId, number>>,
  config: AttackWeaponsBalanceConfig
): number => ATTACK_WEAPON_IDS.reduce(
  (total, weaponId) => total + Math.max(0, Number(loadout[weaponId] || 0)) * config[weaponId].populationRequired,
  0
);

export const resolveAttackWeaponInventory = (
  resourceBalances: Record<string, number>,
  legacyLoadout: Partial<Record<AttackWeaponId, number>>
): Partial<Record<AttackWeaponId, number>> => {
  const hasCanonicalInventory = ATTACK_WEAPON_IDS.some((weaponId) =>
    Object.prototype.hasOwnProperty.call(resourceBalances, weaponId)
  );
  const source = hasCanonicalInventory ? resourceBalances : legacyLoadout;
  return Object.fromEntries(ATTACK_WEAPON_IDS.map((weaponId) => [
    weaponId,
    Math.max(0, Math.floor(Number(source[weaponId] || 0)))
  ])) as Partial<Record<AttackWeaponId, number>>;
};
